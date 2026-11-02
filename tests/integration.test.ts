import { describe, it, expect, beforeEach } from 'vitest';
import { db, seedDemoDataIfEmpty, DEMO_SHOP_ID } from '../src/data/db';
import { calculateBillTotals, calculatePaymentSettlement } from '../src/domain/billing';
import { buildCustomerLedgerSummary, allocateRepayment } from '../src/domain/ledger';
import { searchInventoryItems } from '../src/domain/matching';
import { calculateLineTotal } from '../src/domain/units';
import { createEncryptedBackup, verifyAndPreviewBackup, executeRestore, validateBackupPayload } from '../src/integrations/backup';

describe('End-to-End System Integration Tests', () => {
  beforeEach(async () => {
    await seedDemoDataIfEmpty();
  });

  it('1. Fresh Checkout & Demo Mode: Seeds shop, inventory, and sample bills', async () => {
    const shop = await db.shops.get(DEMO_SHOP_ID);
    expect(shop).toBeDefined();
    expect(shop?.isDemo).toBe(true);
    expect(shop?.name).toContain('मुंशी किराना स्टोर');

    const invCount = await db.inventory.count();
    expect(invCount).toBeGreaterThanOrEqual(7);

    const custCount = await db.customers.count();
    expect(custCount).toBeGreaterThanOrEqual(3);
  });

  it('2. Search & Aliases: Finds Sugar via "SU", "chini", and Groundnut oil via Hindi phrase', async () => {
    const allItems = await db.inventory.toArray();

    const suRes = searchInventoryItems(allItems, 'SU');
    expect(suRes.length).toBeGreaterThan(0);
    expect(suRes[0].item.itemName).toBe('Sugar');

    const chiniRes = searchInventoryItems(allItems, 'chini');
    expect(chiniRes[0].item.itemName).toBe('Sugar');

    const oilRes = searchInventoryItems(allItems, 'mungfali ka tel');
    expect(oilRes[0].item.itemName).toBe('Groundnut Oil');
  });

  it('3. Billing: Overriding Sugar rate from ₹60 to ₹59.50 for 2.5kg totals ₹148.75', () => {
    const total = calculateLineTotal(59.50, 2.5, 'kg', 'kg');
    expect(total.toFixed(2)).toBe('148.75');

    const totals = calculateBillTotals([
      { ratePerBaseUnit: 59.50, quantity: 2.5, billingUnit: 'kg', baseUnit: 'kg' },
      { ratePerBaseUnit: 60, quantity: 250, billingUnit: 'g', baseUnit: 'kg' }, // ₹15.00
    ]);
    expect(totals.subtotal.toFixed(2)).toBe('163.75');
    expect(totals.grandTotal.toFixed(2)).toBe('163.75');
  });

  it('4. Payment Split: ₹750 bill paid ₹250 cash, ₹200 UPI, ₹300 credit reconciles', () => {
    const res = calculatePaymentSettlement(750, 'split', {
      cashPortion: 250,
      upiPortion: 200,
      creditPortion: 300,
      isOwnerConfirmedUpi: true,
      customerId: 'cust-ramesh',
    });
    expect(res.valid).toBe(true);
    expect(res.settlement?.cashReceived).toBe(250);
    expect(res.settlement?.upiReceived).toBe(200);
    expect(res.settlement?.creditDue).toBe(300);
  });

  it('5. Cash Tender & Change: ₹200 tendered for ₹148.75 bill produces ₹51.25 change', () => {
    const res = calculatePaymentSettlement(148.75, 'cash', {
      cashTendered: 200,
    });
    expect(res.valid).toBe(true);
    expect(res.settlement?.cashReceived).toBe(148.75);
    expect(res.settlement?.changeReturned).toBe(51.25);
  });

  it('6. Khata: ₹750 charge - ₹200 repayment leaves ₹550; Reversal restores ₹750', () => {
    const cust = {
      id: 'cust-t1',
      shopId: 's1',
      name: 'Test Customer',
      isActive: true,
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };
    const charges = [
      { id: 'c1', shopId: 's1', customerId: 'cust-t1', amount: 750, transactionDate: '01-11-2026', createdAt: '2026-11-01' },
    ];
    const repayments = [
      { id: 'r1', shopId: 's1', customerId: 'cust-t1', amount: 200, paymentDate: '02-11-2026', method: 'cash' as const, createdAt: '2026-11-02' },
    ];

    const s1 = buildCustomerLedgerSummary(cust, charges, repayments, []);
    expect(s1.outstandingBalance.toNumber()).toBe(550);

    const reversals = [
      { id: 'rev1', shopId: 's1', targetType: 'repayment' as const, targetId: 'r1', reason: 'Error entry', createdAt: '2026-11-02' },
    ];
    const s2 = buildCustomerLedgerSummary(cust, charges, repayments, reversals);
    expect(s2.outstandingBalance.toNumber()).toBe(750);
  });

  it('7. Encrypted Backup & Restore Cycle: Web Crypto AES-GCM export and preview verification', async () => {
    const passphrase = 'SecretPassphrase123!';
    const encryptedJson = await createEncryptedBackup(passphrase);
    expect(encryptedJson).toContain('munsi-kirana-encrypted-backup');

    // Verify preview with correct passphrase
    const preview = await verifyAndPreviewBackup(encryptedJson, passphrase);
    expect(preview.valid).toBe(true);
    expect(preview.counts.inventory).toBeGreaterThanOrEqual(7);

    // Verify rejection with wrong passphrase
    await expect(verifyAndPreviewBackup(encryptedJson, 'WrongPassword')).rejects.toThrow();
  });

  it('8. Barcode Scanning: Matches items by exact barcode or barcode search query', async () => {
    const barcodeItem = {
      id: 'inv-barcode-test',
      shopId: DEMO_SHOP_ID,
      itemName: 'Tata Salt 1kg',
      sellingPrice: 28,
      baseUnit: 'pkt',
      barcode: '8901030383821',
      isActive: true,
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
      version: 1,
    };
    await db.inventory.put(barcodeItem);

    const items = await db.inventory.toArray();
    const match = searchInventoryItems(items, '8901030383821');
    expect(match.length).toBeGreaterThan(0);
    expect(match[0].item.barcode).toBe('8901030383821');
    expect(match[0].item.itemName).toBe('Tata Salt 1kg');
    expect(match[0].matchedField).toBe('barcode');
  });

  it('9. Customer Ledger: Repayment exceeding balance correctly computes advance credit and allocations', () => {
    const cust = {
      id: 'cust-advance-1',
      shopId: 's1',
      name: 'Radhe Shyam',
      isActive: true,
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };
    // ₹550 outstanding charge
    const charges = [
      { id: 'c1', shopId: 's1', customerId: 'cust-advance-1', amount: 550, transactionDate: '01-11-2026', createdAt: '2026-11-01' },
    ];
    // ₹1000 repayment
    const repayments = [
      { id: 'r1', shopId: 's1', customerId: 'cust-advance-1', amount: 1000, paymentDate: '02-11-2026', method: 'cash' as const, createdAt: '2026-11-02' },
    ];

    const summary = buildCustomerLedgerSummary(cust, charges, repayments, []);
    // Outstanding balance should be 0 when overpaid
    expect(summary.outstandingBalance.toNumber()).toBe(0);
    // Advance credit should be ₹450
    expect(summary.advanceCredit.toNumber()).toBe(450);

    // Allocations allocate up to the charge amount (550) to c1, with 450 unallocated (advance)
    const allocResult = allocateRepayment(1000, charges);
    expect(allocResult.allocations.length).toBe(1);
    expect(allocResult.allocations[0].chargeId).toBe('c1');
    expect(allocResult.allocations[0].amount.toNumber()).toBe(550);
    expect(allocResult.unallocatedAmount.toNumber()).toBe(450);
  });

  it('10. Backup Validation: Rejects malformed versions and orphaned records before mutation', () => {
    // 10a. Unsupported version
    expect(() => validateBackupPayload({
      formatVersion: '2.0',
      shop: { id: 's1', name: 'Test Shop' },
      inventory: [],
      customers: [],
      bills: [],
    })).toThrow(/असमर्थित बैकअप संस्करण/);

    // 10b. Missing required core table
    expect(() => validateBackupPayload({
      formatVersion: '1.0',
      shop: { id: 's1', name: 'Test Shop' },
      inventory: [],
      // missing customers
    })).toThrow(/अमान्य बैकअप संरचना/);

    // 10c. Orphaned financial references (charge for non-existent customer)
    expect(() => validateBackupPayload({
      formatVersion: '1.0',
      shop: { id: 's1', name: 'Test Shop' },
      inventory: [],
      customers: [{ id: 'cust-1', name: 'Customer 1' }],
      bills: [],
      credit_charges: [{ id: 'chg-1', customerId: 'cust-ghost', amount: 500 }],
    })).toThrow(/अमान्य वित्तीय संदर्भ/);
  });

  it('11. Backup Integrity: Preserves drafts and receipt_shares in backup payload', async () => {
    await db.drafts.put({
      key: 'active_bill_draft',
      data: [{ itemName: 'Draft Item', quantity: 2 }],
      updatedAt: new Date().toISOString(),
    });
    await db.receipt_shares.put({
      id: 'share-1',
      billId: 'bill-1',
      token: 'tok-123',
      tokenHash: 'hash-123',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      isRevoked: false,
    });

    const passphrase = 'IntegrityCheckPassword!';
    const encrypted = await createEncryptedBackup(passphrase);
    const preview = await verifyAndPreviewBackup(encrypted, passphrase);

    expect(preview.payload.drafts).toBeDefined();
    expect(preview.payload.drafts?.length).toBeGreaterThanOrEqual(1);
    expect(preview.payload.receipt_shares).toBeDefined();
    expect(preview.payload.receipt_shares?.length).toBeGreaterThanOrEqual(1);
  });
});

