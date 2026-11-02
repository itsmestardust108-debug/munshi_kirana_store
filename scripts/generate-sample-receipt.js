import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate synthetic sample bill matching the user's requirements
const receiptData = {
  receiptNumber: 'MKS-20261102-882',
  businessDate: '02-11-2026',
  businessTime: '10:45 AM',
  shopName: 'मुंशी किराना स्टोर (Munsi Kirana Store)',
  ownerBlessing: 'श्री मुंशी सेठ जी का आशीर्वाद',
  tagline: 'आपकी अपनी भरोसेमंद किराना दुकान',
  customerName: 'श्री रमेश कुमार (Ramesh Kumar)',
  customerPhone: '+91 98765 43210',
  items: [
    { name: 'चीनी (Sugar)', qty: '250 g', rate: '₹60.00/kg', amount: '₹15.00' },
    { name: 'चीनी (Sugar 2.5kg Pack)', qty: '2.5 kg', rate: '₹59.50/kg', amount: '₹148.75' },
    { name: 'लाइफबॉय साबुन (Lifebuoy Soap)', qty: '2 नग (pc)', rate: '₹30.00/नग', amount: '₹60.00' },
    { name: 'मूंगफली तेल (Groundnut Oil)', qty: '1 L', rate: '₹185.00/L', amount: '₹185.00' },
    { name: 'टाटा नमक (Tata Salt 1kg)', qty: '1 pkt', rate: '₹28.00/pkt', amount: '₹28.00' },
  ],
  subtotal: '₹436.75',
  discount: '₹6.75',
  grandTotal: '₹430.00',
  cashReceived: '₹200.00',
  upiReceived: '₹150.00',
  balanceDue: '₹80.00',
  thankYouMessage: 'दुकान पर पधारने के लिए आपका धन्यवाद! फिर मिलेंगे।',
};

// 1. Generate text export
const textLines = [
  `*${receiptData.shopName}*`,
  `✨ _${receiptData.ownerBlessing}_`,
  `"${receiptData.tagline}"`,
  `--------------------------------`,
  `रसीद संख्या: #${receiptData.receiptNumber}`,
  `दिनांक: ${receiptData.businessDate} • समय: ${receiptData.businessTime}`,
  `ग्राहक: ${receiptData.customerName} (${receiptData.customerPhone})`,
  `--------------------------------`,
  ...receiptData.items.map(it => `• *${it.name}*: ${it.qty} × ${it.rate} = *${it.amount}*`),
  `--------------------------------`,
  `सामान कुल: ${receiptData.subtotal}`,
  `छूट: -${receiptData.discount}`,
  `*कुल राशि (Grand Total): ${receiptData.grandTotal}*`,
  `नकद प्राप्त: ${receiptData.cashReceived}`,
  `UPI प्राप्त: ${receiptData.upiReceived} (Owner Verified)`,
  `*बाकी उधार (Balance Due): ${receiptData.balanceDue}*`,
  `--------------------------------`,
  `${receiptData.thankYouMessage} 🙏`,
];
const sampleText = textLines.join('\n');

const outputDir = path.resolve(__dirname, '../output/sample');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(path.join(outputDir, 'sample-receipt.txt'), sampleText, 'utf8');

// 2. Generate PDF using jsPDF
const pdf = new jsPDF({
  orientation: 'portrait',
  unit: 'pt',
  format: 'a4',
});

// Deep Purple Header
pdf.setFillColor(95, 37, 159);
pdf.rect(0, 0, 595.28, 120, 'F');

// Gold Accent Bar
pdf.setFillColor(212, 175, 55);
pdf.rect(0, 120, 595.28, 4, 'F');

// Header Text
pdf.setTextColor(255, 255, 255);
pdf.setFont('helvetica', 'bold');
pdf.setFontSize(22);
pdf.text('Munsi Kirana Store', 40, 48);

pdf.setTextColor(255, 215, 0);
pdf.setFontSize(11);
pdf.text("With Shri Munshi Seth Ji's Blessings", 40, 68);

pdf.setTextColor(243, 232, 255);
pdf.setFontSize(10);
pdf.text('"Your trusted family kirana store"', 40, 86);

// Receipt Metadata Box
pdf.setFillColor(248, 247, 251);
pdf.setDrawColor(226, 232, 240);
pdf.roundedRect(40, 140, 515, 60, 8, 8, 'FD');

pdf.setTextColor(30, 41, 59);
pdf.setFontSize(11);
pdf.text(`Receipt #: ${receiptData.receiptNumber}`, 55, 162);
pdf.setTextColor(100, 116, 139);
pdf.setFontSize(9);
pdf.text(`Date: ${receiptData.businessDate} • Time: ${receiptData.businessTime}`, 55, 180);

pdf.setTextColor(30, 41, 59);
pdf.setFontSize(11);
pdf.text(`Customer: ${receiptData.customerName}`, 320, 162);
pdf.setTextColor(100, 116, 139);
pdf.setFontSize(9);
pdf.text(`Phone: ${receiptData.customerPhone}`, 320, 180);

// Table Header
pdf.setFillColor(237, 233, 254);
pdf.rect(40, 215, 515, 24, 'F');
pdf.setTextColor(76, 29, 149);
pdf.setFont('helvetica', 'bold');
pdf.setFontSize(9);
pdf.text('#', 50, 231);
pdf.text('Item Description', 80, 231);
pdf.text('Quantity', 280, 231);
pdf.text('Rate', 380, 231);
pdf.text('Amount', 490, 231);

let y = 252;
receiptData.items.forEach((item, idx) => {
  pdf.setTextColor(100, 116, 139);
  pdf.text(String(idx + 1), 50, y);

  pdf.setTextColor(15, 23, 42);
  pdf.text(item.name.replace(/[^\x00-\x7F]/g, ''), 80, y);

  pdf.setTextColor(51, 65, 85);
  pdf.text(item.qty.replace(/[^\x00-\x7F]/g, ''), 280, y);

  pdf.setTextColor(71, 85, 105);
  pdf.text(item.rate.replace(/[^\x00-\x7F]/g, ''), 380, y);

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.text(item.amount.replace(/[^\x00-\x7F]/g, ''), 490, y);
  pdf.setFont('helvetica', 'normal');

  y += 24;
});

// Totals box
pdf.setFillColor(255, 255, 255);
pdf.setDrawColor(226, 232, 240);
pdf.roundedRect(300, y + 10, 255, 110, 8, 8, 'FD');

pdf.setFontSize(10);
pdf.setTextColor(100, 116, 139);
pdf.text('Subtotal:', 315, y + 32);
pdf.setTextColor(15, 23, 42);
pdf.text(receiptData.subtotal.replace(/[^\x00-\x7F]/g, ''), 490, y + 32);

pdf.setTextColor(5, 150, 105);
pdf.text('Discount:', 315, y + 50);
pdf.text(`-${receiptData.discount.replace(/[^\x00-\x7F]/g, '')}`, 490, y + 50);

// Grand Total Highlight
pdf.setFillColor(95, 37, 159);
pdf.roundedRect(310, y + 62, 235, 28, 6, 6, 'F');
pdf.setTextColor(255, 255, 255);
pdf.setFont('helvetica', 'bold');
pdf.text('Grand Total:', 320, y + 80);
pdf.text(receiptData.grandTotal.replace(/[^\x00-\x7F]/g, ''), 485, y + 80);

// Settlement details
pdf.setFontSize(9);
pdf.setTextColor(71, 85, 105);
pdf.text(`Payment: Cash ${receiptData.cashReceived.replace(/[^\x00-\x7F]/g, '')} | UPI ${receiptData.upiReceived.replace(/[^\x00-\x7F]/g, '')}`, 50, y + 40);
pdf.setTextColor(180, 83, 9);
pdf.setFont('helvetica', 'bold');
pdf.text(`Balance Due (Khata): ${receiptData.balanceDue.replace(/[^\x00-\x7F]/g, '')}`, 50, y + 58);

// Footer
pdf.setFont('helvetica', 'normal');
pdf.setTextColor(148, 163, 184);
pdf.setFontSize(8);
pdf.text('Thank you for shopping with Munsi Kirana Store! Please visit again.', 595.28 / 2, 800, { align: 'center' });

const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
fs.writeFileSync(path.join(outputDir, 'sample-receipt.pdf'), pdfBuffer);

console.log('Sample receipt generated successfully:');
console.log(' - ' + path.join(outputDir, 'sample-receipt.pdf') + ' (' + pdfBuffer.length + ' bytes)');
console.log(' - ' + path.join(outputDir, 'sample-receipt.txt'));
