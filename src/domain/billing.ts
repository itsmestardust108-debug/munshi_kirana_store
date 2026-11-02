import Decimal from 'decimal.js';
import { roundPaise, toDecimal } from './money';
import { calculateLineTotal, toBaseQuantity } from './units';

export interface BillItemSnapshot {
  id: string; // Row ID
  inventoryItemId?: string; // If linked to known catalog item
  itemName: string;
  variantLabel?: string;
  billingUnit: string;
  baseUnit: string;
  defaultSellingPrice: number; // Stored catalog rate
  ratePerBaseUnit: number; // Actual rate charged (can be overridden on this bill)
  isRateOverridden: boolean; // True if rate changed for this bill
  quantity: number;
  baseQuantity: number;
  lineTotal: number;
  costPriceSnapshot?: number | null; // Nullable private cost price snapshot for margin reports
  isUnseenItem?: boolean; // Brand-new product to learn upon save
  isNewVariant?: boolean; // Brand-new pack variant to learn upon save
}

export interface PaymentSettlement {
  method: 'cash' | 'upi' | 'credit' | 'split';
  cashTendered?: number; // Amount given by customer in cash
  cashReceived: number; // Cash portion recorded towards bill
  changeReturned: number; // Change given back to customer (cashTendered - cashReceived)
  upiReceived: number; // UPI portion
  isOwnerConfirmedUpi: boolean; // Required owner confirmation
  creditDue: number; // Udhaar remainder
  customerId?: string; // Required when creditDue > 0
  customerName?: string;
  customerPhone?: string;
}

export interface Bill {
  id: string; // Stable UUID
  shopId: string;
  receiptNumber: string; // e.g. MKS-20261102-001
  businessDate: string; // DD-MM-YYYY
  items: BillItemSnapshot[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  settlement: PaymentSettlement;
  status: 'completed' | 'voided' | 'corrected';
  voidReason?: string;
  correctedBillId?: string; // If replaced by a corrected bill
  createdAt: string; // ISO timestamp
  syncedAt?: string;
  operationId: string; // Stable idempotency key
}

/**
 * Calculates bill totals from line items and optional discount
 */
export function calculateBillTotals(
  items: Array<{
    ratePerBaseUnit: Decimal.Value;
    quantity: Decimal.Value;
    billingUnit: string;
    baseUnit: string;
  }>,
  discountVal: Decimal.Value = 0
): {
  subtotal: Decimal;
  discount: Decimal;
  grandTotal: Decimal;
  lineTotals: Decimal[];
} {
  let subtotal = new Decimal(0);
  const lineTotals: Decimal[] = [];

  for (const item of items) {
    const lineTot = calculateLineTotal(
      item.ratePerBaseUnit,
      item.quantity,
      item.billingUnit,
      item.baseUnit
    );
    lineTotals.push(lineTot);
    subtotal = subtotal.plus(lineTot);
  }

  const roundedSubtotal = roundPaise(subtotal);
  const inputDiscount = roundPaise(discountVal);
  // Discount cannot exceed subtotal
  const safeDiscount = Decimal.min(Decimal.max(inputDiscount, 0), roundedSubtotal);
  const grandTotal = roundPaise(roundedSubtotal.minus(safeDiscount));

  return {
    subtotal: roundedSubtotal,
    discount: safeDiscount,
    grandTotal,
    lineTotals,
  };
}

/**
 * Validates and calculates payment split
 * Scenario 6:
 * - A ₹750 bill paid ₹250 cash, ₹200 UPI, and ₹300 credit reconciles exactly.
 * - Cash ₹200 tendered for a ₹148.75 cash bill produces ₹51.25 change and records ₹148.75 received.
 */
export function calculatePaymentSettlement(
  grandTotal: Decimal.Value,
  method: 'cash' | 'upi' | 'credit' | 'split',
  params: {
    cashTendered?: Decimal.Value;
    cashPortion?: Decimal.Value;
    upiPortion?: Decimal.Value;
    creditPortion?: Decimal.Value;
    isOwnerConfirmedUpi?: boolean;
    customerId?: string;
  }
): {
  valid: boolean;
  settlement?: PaymentSettlement;
  error?: string;
} {
  const total = roundPaise(grandTotal);

  if (method === 'cash') {
    const tendered = params.cashTendered ? roundPaise(params.cashTendered) : total;
    if (tendered.lessThan(total)) {
      return { valid: false, error: 'प्राप्त नकद राशि बिल कुल से कम है (Tendered cash is less than bill total)' };
    }
    const change = roundPaise(tendered.minus(total));
    return {
      valid: true,
      settlement: {
        method: 'cash',
        cashTendered: tendered.toNumber(),
        cashReceived: total.toNumber(),
        changeReturned: change.toNumber(),
        upiReceived: 0,
        isOwnerConfirmedUpi: false,
        creditDue: 0,
      },
    };
  }

  if (method === 'upi') {
    if (!params.isOwnerConfirmedUpi) {
      return { valid: false, error: 'कृपया पुष्टि करें कि UPI भुगतान खाते में प्राप्त हो गया है' };
    }
    return {
      valid: true,
      settlement: {
        method: 'upi',
        cashReceived: 0,
        changeReturned: 0,
        upiReceived: total.toNumber(),
        isOwnerConfirmedUpi: true,
        creditDue: 0,
      },
    };
  }

  if (method === 'credit') {
    if (!params.customerId) {
      return { valid: false, error: 'उधार बिल के लिए ग्राहक चुनना आवश्यक है (Customer required for credit bill)' };
    }
    return {
      valid: true,
      settlement: {
        method: 'credit',
        cashReceived: 0,
        changeReturned: 0,
        upiReceived: 0,
        isOwnerConfirmedUpi: false,
        creditDue: total.toNumber(),
        customerId: params.customerId,
      },
    };
  }

  // Split payment
  const cash = roundPaise(params.cashPortion || 0);
  const upi = roundPaise(params.upiPortion || 0);
  const credit = roundPaise(params.creditPortion || 0);

  if (upi.greaterThan(0) && !params.isOwnerConfirmedUpi) {
    return { valid: false, error: 'UPI राशि के लिए भुगतान प्राप्ति की पुष्टि आवश्यक है' };
  }

  if (credit.greaterThan(0) && !params.customerId) {
    return { valid: false, error: 'उधार शेष के लिए ग्राहक चुनना आवश्यक है (Customer required when credit due exists)' };
  }

  const sumPaid = roundPaise(cash.plus(upi).plus(credit));
  if (!sumPaid.equals(total)) {
    return {
      valid: false,
      error: `भुगतान योग (₹${sumPaid}) बिल कुल (₹${total}) के बराबर होना चाहिए`,
    };
  }

  return {
    valid: true,
    settlement: {
      method: 'split',
      cashReceived: cash.toNumber(),
      changeReturned: 0,
      upiReceived: upi.toNumber(),
      isOwnerConfirmedUpi: Boolean(params.isOwnerConfirmedUpi),
      creditDue: credit.toNumber(),
      customerId: params.customerId,
    },
  };
}
