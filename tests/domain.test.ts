import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { calculateSingleInterest, calculateGrandInterest, parseDate, formatTypedDate } from '../src/domain/interest';
import { calculateLineTotal, toBaseQuantity } from '../src/domain/units';
import { roundPaise, formatINR } from '../src/domain/money';
import { searchInventoryItems } from '../src/domain/matching';
import { calculatePaymentSettlement } from '../src/domain/billing';
import { buildCustomerLedgerSummary, allocateRepayment } from '../src/domain/ledger';

describe('Authoritative Byaj Arithmetic Fixtures (Section 11)', () => {
  it('Fixture 1: ₹10,000 @ 2% from 01-01-2024 to 01-01-2025 -> 1 year, interest ₹2,400, final ₹12,400', () => {
    const res = calculateSingleInterest('f1', 10000, 2, '01-01-2024', '01-01-2025');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.result.duration.years).toBe(1);
    expect(res.result.duration.months).toBe(0);
    expect(res.result.duration.days).toBe(0);
    expect(res.result.totalInterest.toFixed(2)).toBe('2400.00');
    expect(res.result.finalAmount.toFixed(2)).toBe('12400.00');
  });

  it('Fixture 2: ₹10,000 @ 2% from 01-01-2024 to 01-01-2026 -> 2 years, yearly interest ₹2,400 then ₹2,976, final ₹15,376', () => {
    const res = calculateSingleInterest('f2', 10000, 2, '01-01-2024', '01-01-2026');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.result.duration.years).toBe(2);
    expect(res.result.duration.months).toBe(0);
    expect(res.result.duration.days).toBe(0);
    expect(res.result.periods[0].interestAmount.toFixed(2)).toBe('2400.00');
    expect(res.result.periods[1].interestAmount.toFixed(2)).toBe('2976.00');
    expect(res.result.finalAmount.toFixed(2)).toBe('15376.00');
  });

  it('Fixture 3: ₹10,000 @ 2% from 01-01-2024 to 16-03-2026 -> 2 yrs 2 mos 15 days, residual ₹768.80, final ₹16,144.80', () => {
    const res = calculateSingleInterest('f3', 10000, 2, '01-01-2024', '16-03-2026');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.result.duration.years).toBe(2);
    expect(res.result.duration.months).toBe(2);
    expect(res.result.duration.days).toBe(15);
    expect(res.result.periods[2].isResidual).toBe(true);
    expect(res.result.periods[2].interestAmount.toFixed(2)).toBe('768.80');
    expect(res.result.finalAmount.toFixed(2)).toBe('16144.80');
  });

  it('Fixture 4: ₹10,000 @ 2% from 31-01-2025 to 28-02-2025 -> 1 calendar month clamped, final ₹10,200', () => {
    const res = calculateSingleInterest('f4', 10000, 2, '31-01-2025', '28-02-2025');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.result.duration.years).toBe(0);
    expect(res.result.duration.months).toBe(1);
    expect(res.result.duration.days).toBe(0);
    expect(res.result.totalInterest.toFixed(2)).toBe('200.00');
    expect(res.result.finalAmount.toFixed(2)).toBe('10200.00');
  });

  it('Fixture 5: ₹10,000 @ 2% from 29-02-2024 to 28-02-2025 -> 1 completed clamped anniversary, final ₹12,400', () => {
    const res = calculateSingleInterest('f5', 10000, 2, '29-02-2024', '28-02-2025');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.result.duration.years).toBe(1);
    expect(res.result.duration.months).toBe(0);
    expect(res.result.duration.days).toBe(0);
    expect(res.result.totalInterest.toFixed(2)).toBe('2400.00');
    expect(res.result.finalAmount.toFixed(2)).toBe('12400.00');
  });

  it('Fixture 6: ₹10,000 @ 2% from 01-01-2025 to 02-01-2025 -> 1 day, interest ₹6.67, final ₹10,006.67', () => {
    const res = calculateSingleInterest('f6', 10000, 2, '01-01-2025', '02-01-2025');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.result.duration.years).toBe(0);
    expect(res.result.duration.months).toBe(0);
    expect(res.result.duration.days).toBe(1);
    expect(res.result.totalInterest.toFixed(2)).toBe('6.67');
    expect(res.result.finalAmount.toFixed(2)).toBe('10006.67');
  });

  it('Fixture 7: Combined multiple entries: ₹5,000 @ 3% (1 yr = ₹6,800) + Fixture 2 (₹15,376) = ₹22,176 grand total', () => {
    const grand = calculateGrandInterest([
      { id: '1', principal: 10000, monthlyRate: 2, startDate: '01-01-2024', endDate: '01-01-2026' },
      { id: '2', principal: 5000, monthlyRate: 3, startDate: '01-01-2024', endDate: '01-01-2025' },
    ]);
    expect(grand.success).toBe(true);
    if (!grand.success) return;

    expect(grand.result.entries[0].finalAmount.toFixed(2)).toBe('15376.00');
    expect(grand.result.entries[1].finalAmount.toFixed(2)).toBe('6800.00');
    expect(grand.result.combinedPrincipal.toFixed(2)).toBe('15000.00');
    expect(grand.result.combinedInterest.toFixed(2)).toBe('7176.00');
    expect(grand.result.grandTotal.toFixed(2)).toBe('22176.00');
  });

  it('Handles date validation and typing mask', () => {
    expect(parseDate('31-02-2025').valid).toBe(false);
    expect(parseDate('29-02-2024').valid).toBe(true);
    expect(parseDate('29-02-2023').valid).toBe(false);
    expect(formatTypedDate('01012025')).toBe('01-01-2025');
    expect(formatTypedDate('1508')).toBe('15-08');
  });
});

describe('Unit Conversion & Line Total Verification', () => {
  it('Scenario 3: Sugar ₹60/kg overridden to ₹59.50 for 2.5kg totals ₹148.75', () => {
    const total = calculateLineTotal(59.50, 2.5, 'kg', 'kg');
    expect(total.toFixed(2)).toBe('148.75');
  });

  it('Scenario 3: Selling 250g at ₹60/kg totals ₹15.00', () => {
    const baseQty = toBaseQuantity(250, 'g', 'kg');
    expect(baseQty.toNumber()).toBe(0.25);
    const total = calculateLineTotal(60, 250, 'g', 'kg');
    expect(total.toFixed(2)).toBe('15.00');
  });
});

describe('Bilingual Search Matching (Scenario 2)', () => {
  const sampleInventory = [
    {
      id: 'inv-sugar',
      itemName: 'Sugar',
      hindiName: 'चीनी',
      aliases: ['chini', 'cheeni', 'shakkar', 'sugar'],
      variantLabel: '1 kg',
      sellingPrice: 60,
      baseUnit: 'kg',
    },
    {
      id: 'inv-oil',
      itemName: 'Groundnut Oil',
      hindiName: 'मूंगफली का तेल',
      aliases: ['mungfali ka tel', 'moongfali oil', 'groundnut oil'],
      variantLabel: '1 Litre',
      sellingPrice: 180,
      baseUnit: 'l',
    },
    {
      id: 'inv-vim-30',
      itemName: 'Vim Bar',
      hindiName: 'विम साबुन',
      aliases: ['vim', 'bartan bar'],
      variantLabel: '₹30 Pack',
      sellingPrice: 30,
      baseUnit: 'pc',
    },
    {
      id: 'inv-vim-60',
      itemName: 'Vim Bar',
      hindiName: 'विम साबुन',
      aliases: ['vim', 'bartan bar'],
      variantLabel: '₹60 Pack',
      sellingPrice: 60,
      baseUnit: 'pc',
    },
  ];

  it('Matches "SU" to Sugar via prefix priority', () => {
    const results = searchInventoryItems(sampleInventory, 'SU');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.itemName).toBe('Sugar');
  });

  it('Matches Hindi aliases "chini" and "चीनी" to Sugar', () => {
    const res1 = searchInventoryItems(sampleInventory, 'chini');
    expect(res1[0].item.itemName).toBe('Sugar');

    const res2 = searchInventoryItems(sampleInventory, 'चीनी');
    expect(res2[0].item.itemName).toBe('Sugar');
  });

  it('Matches "mungfali ka tel" and "मूंगफली का तेल" to Groundnut Oil', () => {
    const res1 = searchInventoryItems(sampleInventory, 'mungfali ka tel');
    expect(res1[0].item.itemName).toBe('Groundnut Oil');

    const res2 = searchInventoryItems(sampleInventory, 'मूंगफली का तेल');
    expect(res2[0].item.itemName).toBe('Groundnut Oil');
  });

  it('Differentiates explicit pack variants: Vim ₹30 Pack vs ₹60 Pack', () => {
    const res30 = searchInventoryItems(sampleInventory, '30');
    expect(res30.some((r) => r.item.variantLabel === '₹30 Pack')).toBe(true);

    const res60 = searchInventoryItems(sampleInventory, '60');
    expect(res60.some((r) => r.item.variantLabel === '₹60 Pack')).toBe(true);
  });
});

describe('Billing Settlement & Reconciliation (Scenario 6)', () => {
  it('A ₹750 bill paid ₹250 cash, ₹200 UPI, and ₹300 credit reconciles exactly', () => {
    const split = calculatePaymentSettlement(750, 'split', {
      cashPortion: 250,
      upiPortion: 200,
      creditPortion: 300,
      isOwnerConfirmedUpi: true,
      customerId: 'cust-1',
    });
    expect(split.valid).toBe(true);
    if (!split.valid || !split.settlement) return;

    expect(split.settlement.cashReceived).toBe(250);
    expect(split.settlement.upiReceived).toBe(200);
    expect(split.settlement.creditDue).toBe(300);
    expect(split.settlement.customerId).toBe('cust-1');
  });

  it('Cash ₹200 tendered for a ₹148.75 cash bill produces ₹51.25 change and records ₹148.75 received', () => {
    const cashRes = calculatePaymentSettlement(148.75, 'cash', {
      cashTendered: 200,
    });
    expect(cashRes.valid).toBe(true);
    if (!cashRes.valid || !cashRes.settlement) return;

    expect(cashRes.settlement.cashTendered).toBe(200);
    expect(cashRes.settlement.cashReceived).toBe(148.75);
    expect(cashRes.settlement.changeReturned).toBe(51.25);
  });
});

describe('Customer Khata & Repayment Allocation (Scenario 7)', () => {
  const customer = {
    id: 'cust-ramesh',
    shopId: 'shop-1',
    name: 'Ramesh Kumar',
    phone: '9876543210',
    isActive: true,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  };

  it('A ₹750 customer charge followed by a ₹200 repayment leaves ₹550 outstanding', () => {
    const charges = [
      {
        id: 'c-1',
        shopId: 'shop-1',
        customerId: customer.id,
        amount: 750,
        transactionDate: '01-11-2026',
        createdAt: '2026-11-01T10:00:00Z',
      },
    ];
    const repayments = [
      {
        id: 'r-1',
        shopId: 'shop-1',
        customerId: customer.id,
        amount: 200,
        paymentDate: '02-11-2026',
        method: 'cash' as const,
        createdAt: '2026-11-02T11:00:00Z',
      },
    ];

    const summary = buildCustomerLedgerSummary(customer, charges, repayments, []);
    expect(summary.totalCharges.toNumber()).toBe(750);
    expect(summary.totalRepayments.toNumber()).toBe(200);
    expect(summary.outstandingBalance.toNumber()).toBe(550);
    expect(summary.advanceCredit.toNumber()).toBe(0);

    // Allocation check
    const alloc = allocateRepayment(200, charges);
    expect(alloc.allocations.length).toBe(1);
    expect(alloc.allocations[0].chargeId).toBe('c-1');
    expect(alloc.allocations[0].amount.toNumber()).toBe(200);
    expect(alloc.unallocatedAmount.toNumber()).toBe(0);
  });

  it('Reversal of a repayment restores the correct balance of ₹750', () => {
    const charges = [
      {
        id: 'c-1',
        shopId: 'shop-1',
        customerId: customer.id,
        amount: 750,
        transactionDate: '01-11-2026',
        createdAt: '2026-11-01T10:00:00Z',
      },
    ];
    const repayments = [
      {
        id: 'r-1',
        shopId: 'shop-1',
        customerId: customer.id,
        amount: 200,
        paymentDate: '02-11-2026',
        method: 'cash' as const,
        createdAt: '2026-11-02T11:00:00Z',
      },
    ];
    const reversals = [
      {
        id: 'rev-1',
        shopId: 'shop-1',
        targetType: 'repayment' as const,
        targetId: 'r-1',
        reason: 'गलती से गलत राशि दर्ज हो गई थी (Entered by mistake)',
        createdAt: '2026-11-02T11:30:00Z',
      },
    ];

    const summary = buildCustomerLedgerSummary(customer, charges, repayments, reversals);
    expect(summary.totalCharges.toNumber()).toBe(750);
    expect(summary.totalRepayments.toNumber()).toBe(0); // Excluded due to reversal
    expect(summary.outstandingBalance.toNumber()).toBe(750);
  });
});
