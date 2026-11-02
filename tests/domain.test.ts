import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { calculateSingleInterest, calculateGrandInterest, parseDate, formatTypedDate } from '../src/domain/interest';
import { calculateLineTotal, toBaseQuantity, validateQuantity, formatRateWithUnit, getUnitDisplayLabel } from '../src/domain/units';
import { roundPaise, formatINR } from '../src/domain/money';
import { searchInventoryItems } from '../src/domain/matching';
import { calculatePaymentSettlement } from '../src/domain/billing';
import { buildCustomerLedgerSummary, allocateRepayment } from '../src/domain/ledger';
import { buildSanitizedReceipt } from '../src/domain/receipt';
import { generateReceiptText } from '../src/integrations/receiptRenderer';

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

  describe('Quantity Validation & Rate Unit Correctness', () => {
    it('1. Sugar: 250 g at ₹60/kg calculates ₹15.00 with rate unit /kg (never /g)', () => {
      const v = validateQuantity(250, 'g', 'kg');
      expect(v.valid).toBe(true);

      const lineTotal = calculateLineTotal(60, 250, 'g', 'kg');
      expect(lineTotal.toNumber()).toBe(15);

      const rateDisplay = formatRateWithUnit(60, 'kg', true);
      expect(rateDisplay).toBe('₹60.00/किलो');
      expect(rateDisplay).not.toContain('/ग्राम');
    });

    it('2. Sugar: 2.5 kg at ₹59.50/kg calculates ₹148.75', () => {
      const v = validateQuantity(2.5, 'kg', 'kg');
      expect(v.valid).toBe(true);

      const lineTotal = calculateLineTotal(59.50, 2.5, 'kg', 'kg');
      expect(lineTotal.toNumber()).toBe(148.75);

      const rateDisplay = formatRateWithUnit(59.50, 'kg', false);
      expect(rateDisplay).toBe('₹59.50/kg');
    });

    it('3. Pieces: 2 pieces at ₹30/piece = ₹60; Rejects fractional pieces for discrete units', () => {
      const validPc = validateQuantity(2, 'pc', 'pc');
      expect(validPc.valid).toBe(true);

      const total = calculateLineTotal(30, 2, 'pc', 'pc');
      expect(total.toNumber()).toBe(60);

      // Rejects fractional pieces (e.g. 2.5 pieces of soap)
      const invalidFraction = validateQuantity(2.5, 'pc', 'pc');
      expect(invalidFraction.valid).toBe(false);
      expect(invalidFraction.error).toContain('नग (Piece) की मात्रा पूर्ण संख्या होनी चाहिए');
    });

    it('4. Rejects zero, negative, non-finite, and incompatible unit quantities', () => {
      expect(validateQuantity(0, 'kg', 'kg').valid).toBe(false);
      expect(validateQuantity(-5, 'kg', 'kg').valid).toBe(false);
      expect(validateQuantity(NaN, 'kg', 'kg').valid).toBe(false);
      expect(validateQuantity(Infinity, 'kg', 'kg').valid).toBe(false);

      // Incompatible units: cannot convert ml (volume) to kg (weight)
      const incomp = validateQuantity(500, 'ml', 'kg');
      expect(incomp.valid).toBe(false);
      expect(incomp.error).toContain('असंगत इकाई');

      // Do not treat packs as pieces without defined conversion
      const packToPc = validateQuantity(1, 'pack', 'pc');
      expect(packToPc.valid).toBe(false);
    });
  });

  describe('Sanitized Receipt Model & Truthful WhatsApp Text', () => {
    it('5. Builds sanitized receipt model with Dadaji branding, stripping private cost data', () => {
      const sampleBill: any = {
        id: 'bill-test-001',
        shopId: 's1',
        receiptNumber: 'MKS-20261102-123',
        businessDate: '02-11-2026',
        items: [
          {
            id: 'it-1',
            itemName: 'चीनी (Sugar)',
            variantLabel: 'Loose',
            billingUnit: 'g',
            baseUnit: 'kg',
            ratePerBaseUnit: 60,
            quantity: 250,
            baseQuantity: 0.25,
            lineTotal: 15,
            costPriceSnapshot: 48, // Private wholesale cost
          },
          {
            id: 'it-2',
            itemName: 'Liril Soap',
            billingUnit: 'pc',
            baseUnit: 'pc',
            ratePerBaseUnit: 40,
            quantity: 2,
            baseQuantity: 2,
            lineTotal: 80,
            costPriceSnapshot: 32, // Private wholesale cost
          },
        ],
        subtotal: 95,
        discount: 5,
        grandTotal: 90,
        settlement: {
          method: 'split',
          cashReceived: 50,
          upiReceived: 0,
          changeReturned: 0,
          creditDue: 40,
          customerName: 'Shyam Sundar',
          customerPhone: '9876543210',
        },
        status: 'completed',
        createdAt: '2026-11-02T10:30:00Z',
        operationId: 'op-test',
      };

      const receipt = buildSanitizedReceipt(sampleBill, null, {
        isHindi: true,
        useOwnerConfirmedTagline: false,
      });

      // Verify Dadaji photograph & branding
      expect(receipt.photoUrl).toBe('/dadaji-photo.jpg');
      expect(receipt.shopName).toContain('मुंशी किराना स्टोर');
      expect(receipt.ownerBlessing).toContain('श्री मुंशी सेठ जी');
      expect(receipt.tagline).toBe('आपकी अपनी भरोसेमंद किराना दुकान');

      // Verify customer details
      expect(receipt.customerName).toBe('Shyam Sundar');
      expect(receipt.customerPhone).toBe('9876543210');

      // Invariant: Zero cost price snapshots or wholesale data present in receipt
      expect((receipt as any).costPriceSnapshot).toBeUndefined();
      expect((receipt.items[0] as any).costPriceSnapshot).toBeUndefined();
      expect((receipt.items[1] as any).costPriceSnapshot).toBeUndefined();

      // Verify line items and accurate rate unit
      expect(receipt.items[0].formattedQuantity).toBe('250 ग्राम');
      expect(receipt.items[0].formattedRate).toBe('₹60.00/किलो');
      expect(receipt.items[0].formattedLineTotal).toBe('₹15.00');

      // Verify totals
      expect(receipt.subtotal).toBe(95);
      expect(receipt.discount).toBe(5);
      expect(receipt.grandTotal).toBe(90);
      expect(receipt.balanceDue).toBe(40);

      // Verify generated text format
      const text = generateReceiptText(receipt);
      expect(text).toContain('मुंशी किराना स्टोर');
      expect(text).toContain('चीनी (Sugar)');
      expect(text).toContain('250 ग्राम × ₹60.00/किलो = *₹15.00*');
      expect(text).toContain('कुल राशि (Grand Total): ₹90.00');
      expect(text).toContain('बाकी उधार (Balance Due): ₹40.00');
      expect(text).not.toContain('48'); // Wholesale cost never leaked
    });

    it('6. Owner-confirmed historical claim switch updates tagline cleanly', () => {
      const sampleBill: any = {
        id: 'bill-tagline',
        receiptNumber: 'MKS-001',
        businessDate: '02-11-2026',
        items: [],
        subtotal: 0,
        discount: 0,
        grandTotal: 0,
        settlement: { method: 'cash', cashReceived: 0, changeReturned: 0, upiReceived: 0, creditDue: 0 },
        status: 'completed',
        createdAt: '2026-11-02T10:00:00Z',
      };

      const unconfirmed = buildSanitizedReceipt(sampleBill, null, { useOwnerConfirmedTagline: false });
      expect(unconfirmed.tagline).toBe('आपकी अपनी भरोसेमंद किराना दुकान');

      const confirmed = buildSanitizedReceipt(sampleBill, null, { useOwnerConfirmedTagline: true });
      expect(confirmed.tagline).toBe('100 वर्षों से आपके विश्वास का साथ');
    });

    it('7. Displays prominent VOID banner when bill is voided', () => {
      const voidedBill: any = {
        id: 'bill-void',
        receiptNumber: 'MKS-VOID',
        businessDate: '02-11-2026',
        items: [],
        subtotal: 100,
        discount: 0,
        grandTotal: 100,
        settlement: { method: 'cash', cashReceived: 100, changeReturned: 0, upiReceived: 0, creditDue: 0 },
        status: 'voided',
        voidReason: 'गलती से कटा था',
        createdAt: '2026-11-02T10:00:00Z',
      };

      const receipt = buildSanitizedReceipt(voidedBill);
      expect(receipt.isVoided).toBe(true);
      expect(receipt.voidReason).toBe('गलती से कटा था');

      const text = generateReceiptText(receipt);
      expect(text).toContain('रद्द बिल / VOID BILL: गलती से कटा था');
    });
  });
});
