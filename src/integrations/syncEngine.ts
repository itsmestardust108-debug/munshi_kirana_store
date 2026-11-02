import { supabase, isCloudConfigured } from './supabaseClient';
import { db } from '../data/db';
import type { Bill } from '../domain/billing';

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
 * Creates a revocable, expiring public receipt share token
 * Saves to local Dexie and, if cloud is connected, synchronizes to Supabase
 */
export async function createPublicReceiptShare(
  bill: Bill,
  expiryDays = 30
): Promise<{ token: string; shareUrl: string }> {
  const token = generateBearerToken();
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 86400000).toISOString();

  const shareRecord = {
    id: `share-${Date.now()}`,
    billId: bill.id,
    token,
    tokenHash,
    createdAt: now.toISOString(),
    expiresAt,
    isRevoked: false,
  };

  // 1. Save locally in Dexie
  await db.receipt_shares.add(shareRecord);

  // 2. If Supabase is connected, push to Supabase receipt_shares table
  if (supabase && isCloudConfigured) {
    try {
      await supabase.from('receipt_shares').insert({
        id: shareRecord.id,
        shop_id: bill.shopId,
        bill_id: bill.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        is_revoked: false,
      });

      // Also ensure bill and items exist on remote
      await supabase.from('bills').upsert({
        id: bill.id,
        shop_id: bill.shopId,
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

      const billItemsToUpsert = bill.items.map((it) => ({
        id: it.id,
        bill_id: bill.id,
        shop_id: bill.shopId,
        inventory_item_id: it.inventoryItemId || null,
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

      await supabase.from('bill_items').upsert(billItemsToUpsert);
    } catch (err) {
      console.warn('Background cloud receipt share push postponed:', err);
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/r/${token}`;

  return { token, shareUrl };
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
