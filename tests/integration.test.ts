import { describe, it, expect, beforeEach } from 'vitest';
import { db, seedDemoDataIfEmpty, DEMO_SHOP_ID } from '../src/data/db';
import { calculateBillTotals, calculatePaymentSettlement } from '../src/domain/billing';
import { buildCustomerLedgerSummary, allocateRepayment } from '../src/domain/ledger';
import { searchInventoryItems } from '../src/domain/matching';
import { calculateLineTotal } from '../src/domain/units';
import { createEncryptedBackup, verifyAndPreviewBackup, executeRestore } from '../src/integrations/backup';

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
});

