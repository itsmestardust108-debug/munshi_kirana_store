import type { Bill } from './billing';
import type { ShopRecord } from '../data/db';
import { formatINR } from './money';
import { formatRateWithUnit, getUnitDisplayLabel } from './units';

export interface SanitizedReceiptItem {
  id: string;
  itemName: string;
  variantLabel?: string;
  quantity: number;
  billingUnit: string;
  baseUnit: string;
  rate: number;
  rateUnit: string;
  formattedRate: string; // e.g. "₹60.00/kg"
  formattedQuantity: string; // e.g. "250 g" or "2.5 kg" or "2 नग"
  lineTotal: number;
  formattedLineTotal: string; // e.g. "₹15.00"
}

export interface SanitizedReceipt {
  billId: string;
  receiptNumber: string;
  businessDate: string;
  businessTime: string;
  shopName: string;
  ownerBlessing: string;
  tagline: string;
  isOwnerConfirmedTagline: boolean;
  photoUrl: string;
  customerName?: string;
  customerPhone?: string;
  items: SanitizedReceiptItem[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  paymentMethod: 'cash' | 'upi' | 'credit' | 'split';
  cashReceived: number;
  changeReturned: number;
  upiReceived: number;
  balanceDue: number; // Bill's remaining credit due
  isVoided: boolean;
  isCorrected: boolean;
  voidReason?: string;
  thankYouMessage: string;
}

/**
 * Builds a strictly sanitized, customer-safe receipt model.
 * INVARIANT: Never exposes cost prices, wholesale photographs, internal notes, or unrelated customer debts.
 */
export function buildSanitizedReceipt(
  bill: Bill,
  shop?: Partial<ShopRecord> | null,
  options?: {
    isHindi?: boolean;
    useOwnerConfirmedTagline?: boolean;
  }
): SanitizedReceipt {
  const isHi = options?.isHindi !== false;
  const isOwnerConfirmed = Boolean(options?.useOwnerConfirmedTagline);

  // Proposed owner-confirmed wording vs default unconfirmed tagline
  const tagline = isOwnerConfirmed
    ? isHi
      ? '100 वर्षों से आपके विश्वास का साथ'
      : 'Trusted for over 100 years'
    : isHi
    ? 'आपकी अपनी भरोसेमंद किराना दुकान'
    : 'Your trusted family kirana store';

  // Format date and time
  const createdDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
  const businessTime = createdDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const sanitizedItems: SanitizedReceiptItem[] = bill.items.map((item) => {
    const rateUnitLabel = getUnitDisplayLabel(item.baseUnit, isHi);
    const billingUnitLabel = getUnitDisplayLabel(item.billingUnit, isHi);

    return {
      id: item.id,
      itemName: item.itemName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      billingUnit: item.billingUnit,
      baseUnit: item.baseUnit,
      rate: item.ratePerBaseUnit,
      rateUnit: rateUnitLabel,
      formattedRate: formatRateWithUnit(item.ratePerBaseUnit, item.baseUnit, isHi),
      formattedQuantity: `${item.quantity} ${billingUnitLabel}`,
      lineTotal: item.lineTotal,
      formattedLineTotal: formatINR(item.lineTotal),
    };
  });

  return {
    billId: bill.id,
    receiptNumber: bill.receiptNumber,
    businessDate: bill.businessDate,
    businessTime,
    shopName: shop?.name || (isHi ? 'मुंशी किराना स्टोर' : 'Munsi Kirana Store'),
    ownerBlessing: isHi ? 'श्री मुंशी सेठ जी का आशीर्वाद' : "With Shri Munshi Seth Ji's Blessings",
    tagline,
    isOwnerConfirmedTagline: isOwnerConfirmed,
    photoUrl: '/dadaji-photo.jpg',
    customerName: bill.settlement.customerName || undefined,
    customerPhone: bill.settlement.customerPhone || undefined,
    items: sanitizedItems,
    subtotal: bill.subtotal,
    discount: bill.discount,
    grandTotal: bill.grandTotal,
    paymentMethod: bill.settlement.method,
    cashReceived: bill.settlement.cashReceived || 0,
    changeReturned: bill.settlement.changeReturned || 0,
    upiReceived: bill.settlement.upiReceived || 0,
    balanceDue: bill.settlement.creditDue || 0,
    isVoided: bill.status === 'voided',
    isCorrected: bill.status === 'corrected',
    voidReason: bill.voidReason,
    thankYouMessage: isHi
      ? 'दुकान पर पधारने के लिए आपका धन्यवाद! फिर मिलेंगे।'
      : 'Thank you for shopping with us! Please visit again.',
  };
}
