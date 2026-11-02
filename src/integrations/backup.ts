import { db } from '../data/db';

export interface BackupPayload {
  formatVersion: '1.0';
  exportedAt: string;
  shop: any;
  inventory: any[];
  customers: any[];
  bills: any[];
  credit_charges: any[];
  repayments: any[];
  payment_allocations: any[];
  ledger_reversals: any[];
  attachments: any[];
  inventory_attachments: any[];
  drafts?: any[];
  receipt_shares?: any[];
}

export interface EncryptedBackupEnvelope {
  type: 'munsi-kirana-encrypted-backup';
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltHex: string;
  ivHex: string;
  ciphertextHex: string;
}

function bufferToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations = 100000): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Creates an encrypted full backup of the shop
 */
export async function createEncryptedBackup(passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error('बैकअप के लिए कम से कम 4 अक्षरों का पासवर्ड आवश्यक है');
  }

  // 1. Gather all local tables from Dexie
  const shop = await db.shops.toCollection().first();
  const inventory = await db.inventory.toArray();
  const customers = await db.customers.toArray();
  const bills = await db.bills.toArray();
  const credit_charges = await db.credit_charges.toArray();
  const repayments = await db.repayments.toArray();
  const payment_allocations = await db.payment_allocations.toArray();
  const ledger_reversals = await db.ledger_reversals.toArray();
  const attachments = await db.attachments.toArray();
  const inventory_attachments = await db.inventory_attachments.toArray();
  const drafts = await db.drafts.toArray();
  const receipt_shares = await db.receipt_shares.toArray();

  const payload: BackupPayload = {
    formatVersion: '1.0',
    exportedAt: new Date().toISOString(),
    shop,
    inventory,
    customers,
    bills,
    credit_charges,
    repayments,
    payment_allocations,
    ledger_reversals,
    attachments,
    inventory_attachments,
    drafts,
    receipt_shares,
  };

  const payloadJson = JSON.stringify(payload);
  const enc = new TextEncoder();
  const dataBytes = enc.encode(payloadJson);

  // 2. Generate random Salt (16 bytes) and IV (12 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 3. Derive key and encrypt with AES-GCM
  const key = await deriveAesKey(passphrase, salt);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBytes
  );

  const envelope: EncryptedBackupEnvelope = {
    type: 'munsi-kirana-encrypted-backup',
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: 100000,
    saltHex: bufferToHex(salt),
    ivHex: bufferToHex(iv),
    ciphertextHex: bufferToHex(new Uint8Array(ciphertextBuffer)),
  };

  return JSON.stringify(envelope, null, 2);
}

export interface RestorePreview {
  valid: boolean;
  exportedAt: string;
  shopName: string;
  counts: {
    inventory: number;
    customers: number;
    bills: number;
    charges: number;
    repayments: number;
    attachments: number;
  };
  payload: BackupPayload;
}

export function validateBackupPayload(payload: any): void {
  if (!payload || typeof payload !== 'object') {
    throw new Error('अमान्य बैकअप फाइल (Invalid backup payload)');
  }
  if (payload.formatVersion !== '1.0') {
    throw new Error('असमर्थित बैकअप संस्करण (Unsupported backup format version)');
  }
  if (!payload.shop || typeof payload.shop !== 'object' || !payload.shop.id || !payload.shop.name) {
    throw new Error('अमान्य दुकान विवरण (Invalid shop details in backup)');
  }
  if (
    !Array.isArray(payload.inventory) ||
    !Array.isArray(payload.customers) ||
    !Array.isArray(payload.bills)
  ) {
    throw new Error('अमान्य बैकअप संरचना (Missing required core tables in backup)');
  }

  // Relational integrity check: Customers
  const customerIds = new Set(
    (payload.customers || []).map((c: any) => c?.id).filter(Boolean)
  );

  if (Array.isArray(payload.credit_charges) && payload.credit_charges.length > 0) {
    for (const charge of payload.credit_charges) {
      if (!charge.customerId || !customerIds.has(charge.customerId)) {
        throw new Error(
          `अमान्य वित्तीय संदर्भ: उधार चार्ज ${charge.id} का ग्राहक मौजूद नहीं है (Orphaned charge without customer)`
        );
      }
    }
  }

  if (Array.isArray(payload.repayments) && payload.repayments.length > 0) {
    for (const repay of payload.repayments) {
      if (!repay.customerId || !customerIds.has(repay.customerId)) {
        throw new Error(
          `अमान्य वित्तीय संदर्भ: भुगतान ${repay.id} का ग्राहक मौजूद नहीं है (Orphaned repayment without customer)`
        );
      }
    }
  }
}

/**
 * Decrypts and validates an encrypted backup string without modifying the DB
 */
export async function verifyAndPreviewBackup(
  backupJson: string,
  passphrase: string
): Promise<RestorePreview> {
  let envelope: EncryptedBackupEnvelope;
  try {
    envelope = JSON.parse(backupJson);
  } catch {
    throw new Error('अमान्य बैकअप फाइल (Not a valid JSON backup file)');
  }

  if (envelope.type !== 'munsi-kirana-encrypted-backup' || !envelope.ciphertextHex) {
    throw new Error('यह मुंशी किराना स्टोर की बैकअप फाइल नहीं है');
  }

  const salt = hexToBuffer(envelope.saltHex);
  const iv = hexToBuffer(envelope.ivHex);
  const ciphertext = hexToBuffer(envelope.ciphertextHex);

  const key = await deriveAesKey(passphrase, salt, envelope.iterations || 100000);

  let decryptedBytes: ArrayBuffer;
  try {
    decryptedBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      ciphertext as any
    );
  } catch {
    throw new Error('गलत पासवर्ड! कृपया सही बैकअप पासवर्ड दर्ज करें');
  }

  const dec = new TextDecoder();
  const payload: BackupPayload = JSON.parse(dec.decode(decryptedBytes));

  validateBackupPayload(payload);

  return {
    valid: true,
    exportedAt: payload.exportedAt,
    shopName: payload.shop?.name || 'Munsi Kirana Store',
    counts: {
      inventory: payload.inventory?.length || 0,
      customers: payload.customers?.length || 0,
      bills: payload.bills?.length || 0,
      charges: payload.credit_charges?.length || 0,
      repayments: payload.repayments?.length || 0,
      attachments: payload.attachments?.length || 0,
    },
    payload,
  };
}

/**
 * Restores data transactionally into Dexie
 */
export async function executeRestore(payload: BackupPayload): Promise<void> {
  // Validate schema and relational integrity BEFORE starting transaction
  validateBackupPayload(payload);

  await db.transaction(
    'rw',
    [
      db.shops,
      db.inventory,
      db.customers,
      db.bills,
      db.credit_charges,
      db.repayments,
      db.payment_allocations,
      db.ledger_reversals,
      db.attachments,
      db.inventory_attachments,
      db.drafts,
      db.receipt_shares,
    ],
    async () => {
      // Clear existing records
      await Promise.all([
        db.shops.clear(),
        db.inventory.clear(),
        db.customers.clear(),
        db.bills.clear(),
        db.credit_charges.clear(),
        db.repayments.clear(),
        db.payment_allocations.clear(),
        db.ledger_reversals.clear(),
        db.attachments.clear(),
        db.inventory_attachments.clear(),
        db.drafts.clear(),
        db.receipt_shares.clear(),
      ]);

      // Bulk insert restored payload
      if (payload.shop) await db.shops.add(payload.shop);
      if (payload.inventory?.length) await db.inventory.bulkAdd(payload.inventory);
      if (payload.customers?.length) await db.customers.bulkAdd(payload.customers);
      if (payload.bills?.length) await db.bills.bulkAdd(payload.bills);
      if (payload.credit_charges?.length) await db.credit_charges.bulkAdd(payload.credit_charges);
      if (payload.repayments?.length) await db.repayments.bulkAdd(payload.repayments);
      if (payload.payment_allocations?.length) await db.payment_allocations.bulkAdd(payload.payment_allocations);
      if (payload.ledger_reversals?.length) await db.ledger_reversals.bulkAdd(payload.ledger_reversals);
      if (payload.attachments?.length) await db.attachments.bulkAdd(payload.attachments);
      if (payload.inventory_attachments?.length) await db.inventory_attachments.bulkAdd(payload.inventory_attachments);
      if (payload.drafts?.length) await db.drafts.bulkAdd(payload.drafts);
      if (payload.receipt_shares?.length) await db.receipt_shares.bulkAdd(payload.receipt_shares);
    }
  );
}
