import type { Bill } from '../domain/billing';
import { formatINR } from '../domain/money';

/**
 * Normalizes an Indian phone number to 10-digit or E.164 (91XXXXXXXXXX)
 */
export function normalizeIndianPhone(rawPhone?: string): { valid: boolean; normalized?: string; display?: string } {
  if (!rawPhone) return { valid: false };

  // Strip spaces, hyphens, parentheses, plus
  const digits = rawPhone.replace(/\D/g, '');

  let tenDigits = '';
  if (digits.length === 10) {
    tenDigits = digits;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    tenDigits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    tenDigits = digits.slice(1);
  } else {
    return { valid: false };
  }

  // Check valid Indian mobile prefix (starts with 6, 7, 8, or 9)
  if (!/^[6-9]\d{9}$/.test(tenDigits)) {
    return { valid: false };
  }

  return {
    valid: true,
    normalized: `91${tenDigits}`,
    display: `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`,
  };
}

/**
 * Builds WhatsApp message text and deep link for a sale receipt
 */
export function buildBillWhatsAppLink(
  bill: Bill,
  customerPhone?: string,
  storeName = 'मुंशी किराना स्टोर',
  publicReceiptUrl?: string
): { url?: string; messageText: string; isPhoneValid: boolean } {
  const norm = normalizeIndianPhone(customerPhone);
  const isOnline = Boolean(publicReceiptUrl);

  const lines: string[] = [
    `*${storeName}*`,
    `बिक्री रसीद संख्या: #${bill.receiptNumber}`,
    `तारीख: ${bill.businessDate}`,
    `--------------------------`,
  ];

  for (const item of bill.items) {
    lines.push(`• ${item.itemName} (${item.variantLabel || item.billingUnit}): ${item.quantity} ${item.billingUnit} × ₹${item.ratePerBaseUnit} = ₹${item.lineTotal}`);
  }

  lines.push(`--------------------------`);
  if (bill.discount > 0) {
    lines.push(`सामान कुल: ₹${bill.subtotal}`);
    lines.push(`छूट: -₹${bill.discount}`);
  }
  lines.push(`*कुल राशि (Grand Total): ₹${bill.grandTotal}*`);

  if (bill.settlement.cashReceived > 0) {
    lines.push(`नकद प्राप्त: ₹${bill.settlement.cashReceived}`);
  }
  if (bill.settlement.upiReceived > 0) {
    lines.push(`UPI प्राप्त: ₹${bill.settlement.upiReceived}`);
  }
  if (bill.settlement.creditDue > 0) {
    lines.push(`*बाकी उधार (Balance Due): ₹${bill.settlement.creditDue}*`);
  }

  if (isOnline) {
    lines.push(`\nडिजिटल बिल यहाँ देखें: ${publicReceiptUrl}`);
  } else {
    lines.push(`\nखरीदारी के लिए धन्यवाद! 🙏`);
  }

  const messageText = lines.join('\n');
  const encodedText = encodeURIComponent(messageText);

  const url = norm.valid && norm.normalized
    ? `https://wa.me/${norm.normalized}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  return {
    url,
    messageText,
    isPhoneValid: norm.valid,
  };
}

/**
 * Builds polite bilingual WhatsApp reminder for credit customer
 */
export function buildLedgerReminderWhatsAppLink(
  customerName: string,
  customerPhone: string | undefined,
  outstandingBalance: number,
  storeName = 'मुंशी किराना स्टोर'
): { url?: string; messageText: string; isPhoneValid: boolean } {
  const norm = normalizeIndianPhone(customerPhone);
  const formattedAmount = formatINR(outstandingBalance);

  const messageText =
    `नमस्ते ${customerName} जी, 🙏\n\n` +
    `यह *${storeName}* से एक विनम्र संदेश है। आपके खाते का कुल बाकी उधार ${formattedAmount} है।\n\n` +
    `कृपया सुविधानुसार दुकान पर आकर या UPI द्वारा भुगतान करने का कष्ट करें।\n` +
    `धन्यवाद!`;

  const encodedText = encodeURIComponent(messageText);

  const url = norm.valid && norm.normalized
    ? `https://wa.me/${norm.normalized}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  return {
    url,
    messageText,
    isPhoneValid: norm.valid,
  };
}
