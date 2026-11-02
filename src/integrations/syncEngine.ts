import { supabase, isCloudConfigured } from './supabaseClient';
import { db, DEMO_SHOP_ID } from '../data/db';
import type { Bill } from '../domain/billing';

/**
 * Deterministically maps any local string identifier to a valid RFC 4122 UUID v4
 * to prevent PostgreSQL "invalid input syntax for type uuid" errors.
 */
export function toValidUuid(id: string): string {
  if (!id) return '00000000-0000-4000-8000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const enc = new TextEncoder();
  const pad = Array.from(enc.encode(id))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .padEnd(24, '0')
    .slice(0, 24);

  return `${hex.slice(0, 8)}-${pad.slice(0, 4)}-4${pad.slice(5, 8)}-8${pad.slice(9, 12)}-${pad.slice(12, 24)}`;
}

export async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateBearerToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Creates a revocable, expiring public receipt share token.
 * Saves to local Dexie and, if cloud is connected, synchronizes to Supabase.
 * Returns whether remote hosting was confirmed or queued in outbox.
 */
export async function createPublicReceiptShare(
  bill: Bill,
  expiryDays = 30
): Promise<{ token: string; shareUrl: string; isHosted: boolean; error?: string }> {
  const token = generateBearerToken();
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 86400000).toISOString();

  const shareRecord = {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : toValidUuid(`share-${Date.now()}`),
    billId: bill.id,
    token,
    tokenHash,
    createdAt: now.toISOString(),
    expiresAt,
    isRevoked: false,
  };

  // 1. Save locally in Dexie
  await db.receipt_shares.add(shareRecord);

  let isHosted = false;
  let remoteError: string | undefined;

  // 2. If Supabase is connected, push to Supabase
  if (supabase && isCloudConfigured) {
    try {
      const validShopId = toValidUuid(bill.shopId || DEMO_SHOP_ID);
      const validBillId = toValidUuid(bill.id);

      // Ensure bill exists on remote
      const { error: billError } = await supabase.from('bills').upsert({
        id: validBillId,
        shop_id: validShopId,
        receipt_number: bill.receiptNumber,
        business_date: bill.businessDate,
        subtotal: bill.subtotal,
        discount: bill.discount,
        grand_total: bill.grandTotal,
        settlement_json: bill.settlement,
        status: bill.status,
        operation_id: bill.operationId,
        created_at: bill.createdAt,
      });

      if (billError) throw billError;

      const billItemsToUpsert = bill.items.map((it) => ({
        id: toValidUuid(it.id),
        bill_id: validBillId,
        shop_id: validShopId,
        inventory_item_id: it.inventoryItemId ? toValidUuid(it.inventoryItemId) : null,
        item_name: it.itemName,
        variant_label: it.variantLabel || null,
        billing_unit: it.billingUnit,
        base_unit: it.baseUnit,
        rate_per_base_unit: it.ratePerBaseUnit,
        is_rate_overridden: it.isRateOverridden,
        quantity: it.quantity,
        base_quantity: it.baseQuantity,
        line_total: it.lineTotal,
      }));

      const { error: itemsError } = await supabase.from('bill_items').upsert(billItemsToUpsert);
      if (itemsError) throw itemsError;

      // Insert receipt share
      const { error: shareError } = await supabase.from('receipt_shares').insert({
        id: shareRecord.id,
        shop_id: validShopId,
        bill_id: validBillId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        is_revoked: false,
      });

      if (shareError) throw shareError;

      isHosted = true;
    } catch (err: any) {
      remoteError = err?.message || 'Remote write failed';
      console.warn('Remote receipt share postponed to outbox:', remoteError);

      // Queue in sync_outbox for background synchronization
      await queueOutboxSync('receipt_share', shareRecord.id, 'insert', shareRecord);
    }
  } else {
    // Cloud unconfigured: queue locally
    await queueOutboxSync('receipt_share', shareRecord.id, 'insert', shareRecord);
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/r/${token}`;

  return { token, shareUrl, isHosted, error: remoteError };
}

/**
 * Fetches public receipt using token hash across devices via Supabase RPC
 */
export async function fetchRemotePublicReceipt(token: string): Promise<any | null> {
  if (!supabase || !isCloudConfigured) return null;

  try {
    const tokenHash = await hashToken(token);
    const { data, error } = await supabase.rpc('get_public_receipt', {
      p_token_hash: tokenHash,
    });

    if (error || !data || !data.success) {
      return null;
    }

    return data.receipt;
  } catch {
    return null;
  }
}

/**
 * Queues an entity operation into Dexie's sync_outbox table
 */
export async function queueOutboxSync(
  entityType: 'bill' | 'inventory' | 'customer' | 'charge' | 'repayment' | 'reversal' | 'receipt_share',
  entityId: string,
  operation: 'insert' | 'update' | 'delete',
  payload?: any
): Promise<void> {
  try {
    await db.sync_outbox.add({
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `outbox-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      shopId: DEMO_SHOP_ID,
      entityType: entityType as any,
      entityId,
      operation,
      payload: payload || null,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to queue to sync_outbox:', err);
  }
}

/**
 * Processes queued items in sync_outbox and syncs them to Supabase
 */
export async function processOutbox(): Promise<{ processed: number; remaining: number }> {
  if (!supabase || !isCloudConfigured) {
    const remaining = await db.sync_outbox.count();
    return { processed: 0, remaining };
  }

  const items = await db.sync_outbox.where('status').equals('pending').limit(20).toArray();
  let processed = 0;

  for (const item of items) {
    try {
      let uploadSuccessful = false;

      if (item.entityType === 'inventory' && item.payload) {
        const inv = item.payload;
        const { error } = await supabase.from('inventory').upsert({
          id: toValidUuid(inv.id),
          shop_id: toValidUuid(inv.shopId || DEMO_SHOP_ID),
          item_name: inv.itemName,
          variant_label: inv.variantLabel || null,
          hindi_name: inv.hindiName || null,
          selling_price: inv.sellingPrice,
          cost_price: inv.costPrice || null,
          base_unit: inv.baseUnit,
          is_active: inv.isActive ?? true,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        uploadSuccessful = true;
      } else if (item.entityType === 'customer' && item.payload) {
        const cust = item.payload;
        const { error } = await supabase.from('customers').upsert({
          id: toValidUuid(cust.id),
          shop_id: toValidUuid(cust.shopId || DEMO_SHOP_ID),
          name: cust.name,
          phone: cust.phone || null,
          notes: cust.notes || null,
          is_active: cust.isActive ?? true,
        });
        if (error) throw error;
        uploadSuccessful = true;
      } else if (item.entityType === 'bill' && item.payload) {
        const bill = item.payload;
        const validShopId = toValidUuid(bill.shopId || DEMO_SHOP_ID);
        const validBillId = toValidUuid(bill.id);
        const { error: billError } = await supabase.from('bills').upsert({
          id: validBillId,
          shop_id: validShopId,
          receipt_number: bill.receiptNumber,
          business_date: bill.businessDate,
          subtotal: bill.subtotal,
          discount: bill.discount,
          grand_total: bill.grandTotal,
          settlement_json: bill.settlement,
          status: bill.status,
          operation_id: bill.operationId,
          created_at: bill.createdAt,
        });
        if (billError) throw billError;

        if (bill.items && Array.isArray(bill.items)) {
          const itemsToUpsert = bill.items.map((it: any) => ({
            id: toValidUuid(it.id),
            bill_id: validBillId,
            shop_id: validShopId,
            inventory_item_id: it.inventoryItemId ? toValidUuid(it.inventoryItemId) : null,
            item_name: it.itemName,
            variant_label: it.variantLabel || null,
            billing_unit: it.billingUnit,
            base_unit: it.baseUnit,
            rate_per_base_unit: it.ratePerBaseUnit,
            is_rate_overridden: it.isRateOverridden,
            quantity: it.quantity,
            base_quantity: it.baseQuantity,
            line_total: it.lineTotal,
          }));
          const { error: itemsError } = await supabase.from('bill_items').upsert(itemsToUpsert);
          if (itemsError) throw itemsError;
        }
        uploadSuccessful = true;
      } else if (item.entityType === 'receipt_share' && item.payload) {
        const share = item.payload;
        const validShopId = toValidUuid(DEMO_SHOP_ID);
        const validBillId = toValidUuid(share.billId);
        const { error } = await supabase.from('receipt_shares').insert({
          id: toValidUuid(share.id),
          shop_id: validShopId,
          bill_id: validBillId,
          token_hash: share.tokenHash,
          expires_at: share.expiresAt,
          is_revoked: share.isRevoked ?? false,
        });
        if (error) throw error;
        uploadSuccessful = true;
      } else if (item.entityType === 'charge' && item.payload) {
        const charge = item.payload;
        const { error } = await supabase.from('ledger_charges').upsert({
          id: toValidUuid(charge.id),
          shop_id: toValidUuid(charge.shopId || DEMO_SHOP_ID),
          customer_id: toValidUuid(charge.customerId),
          bill_id: charge.billId ? toValidUuid(charge.billId) : null,
          amount: charge.amount,
          operation_id: charge.operationId,
          created_at: charge.createdAt,
        });
        if (error) throw error;
        uploadSuccessful = true;
      } else if (item.entityType === 'repayment' && item.payload) {
        const rep = item.payload;
        const { error } = await supabase.from('ledger_repayments').upsert({
          id: toValidUuid(rep.id),
          shop_id: toValidUuid(rep.shopId || DEMO_SHOP_ID),
          customer_id: toValidUuid(rep.customerId),
          amount: rep.amount,
          operation_id: rep.operationId,
          created_at: rep.createdAt,
        });
        if (error) throw error;
        uploadSuccessful = true;
      } else if (item.entityType === 'reversal' && item.payload) {
        const rev = item.payload;
        const { error } = await supabase.from('ledger_reversals').upsert({
          id: toValidUuid(rev.id),
          shop_id: toValidUuid(rev.shopId || DEMO_SHOP_ID),
          target_entity_type: rev.targetEntityType,
          target_entity_id: toValidUuid(rev.targetEntityId),
          reason: rev.reason,
          operation_id: rev.operationId,
          created_at: rev.createdAt,
        });
        if (error) throw error;
        uploadSuccessful = true;
      }

      if (uploadSuccessful) {
        await db.sync_outbox.delete(item.id);
        processed++;
      } else {
        // Unknown or empty payload entity: mark error and do not delete
        await db.sync_outbox.update(item.id, {
          retryCount: (item.retryCount || 0) + 1,
          errorMessage: `Unhandled entityType or missing payload: ${item.entityType}`,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      await db.sync_outbox.update(item.id, {
        retryCount: (item.retryCount || 0) + 1,
        errorMessage: err?.message || 'Sync error',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const remaining = await db.sync_outbox.where('status').equals('pending').count();
  return { processed, remaining };
}

/**
 * Pulls changes from Supabase down to local Dexie to keep two phones synchronized
 */
export async function pullRemoteChanges(shopId = DEMO_SHOP_ID): Promise<{ updatedCount: number }> {
  if (!supabase || !isCloudConfigured) return { updatedCount: 0 };

  const validShopId = toValidUuid(shopId);
  let updatedCount = 0;

  try {
    // 1. Pull Inventory
    const { data: invList } = await supabase
      .from('inventory')
      .select('*')
      .eq('shop_id', validShopId);

    if (invList && invList.length > 0) {
      for (const row of invList) {
        const existing = await db.inventory.get(row.id);
        if (!existing || new Date(row.updated_at) > new Date(existing.updatedAt)) {
          await db.inventory.put({
            id: row.id,
            shopId,
            itemName: row.item_name,
            variantLabel: row.variant_label,
            hindiName: row.hindi_name,
            sellingPrice: Number(row.selling_price),
            costPrice: row.cost_price != null ? Number(row.cost_price) : null,
            baseUnit: row.base_unit,
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            version: row.version || 1,
          });
          updatedCount++;
        }
      }
    }

    // 2. Pull Customers
    const { data: custList } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', validShopId);

    if (custList && custList.length > 0) {
      for (const row of custList) {
        await db.customers.put({
          id: row.id,
          shopId,
          name: row.name,
          phone: row.phone,
          notes: row.notes,
          isActive: row.is_active,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
        });
        updatedCount++;
      }
    }
  } catch (err) {
    console.warn('Pull remote changes postponed:', err);
  }

  return { updatedCount };
}
