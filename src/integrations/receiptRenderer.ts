import { jsPDF } from 'jspdf';
import type { SanitizedReceipt } from '../domain/receipt';
import { formatINR } from '../domain/money';

/**
 * Loads an image with a timeout fallback
 */
function loadImage(src: string, timeoutMs = 2000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      return resolve(null);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(img);
      }
    };
    img.onerror = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(null);
      }
    };
    img.src = src;
  });
}

/**
 * Helper to wrap text into multiple lines given maxWidth
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(`${currentLine} ${word}`).width;
    if (width < maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

const PAGE_WIDTH = 700;
const PAGE_HEIGHT = 1000;
const SCALE = 2; // For Retina / High-DPI crispness

/**
 * Renders a SanitizedReceipt onto one or more HTMLCanvasElement pages.
 * Fully supports Hindi Devanagari text, Unicode ₹ symbol, Dadaji's portrait,
 * and clean multi-page pagination without cutting table rows or totals.
 */
export async function renderReceiptToCanvas(
  receipt: SanitizedReceipt
): Promise<HTMLCanvasElement[]> {
  const dadajiImg = await loadImage(receipt.photoUrl || '/dadaji-photo.jpg');

  // Calculate pagination:
  // Page 1 with header can fit ~8-10 items. Subsequent pages can fit ~14 items.
  const items = receipt.items;
  const pagesData: Array<{ items: typeof items; isFirstPage: boolean; isLastPage: boolean; pageIndex: number }> = [];

  const FIRST_PAGE_MAX = 8;
  const SUBSEQUENT_PAGE_MAX = 14;

  if (items.length <= FIRST_PAGE_MAX) {
    pagesData.push({ items, isFirstPage: true, isLastPage: true, pageIndex: 1 });
  } else {
    // First page
    pagesData.push({
      items: items.slice(0, FIRST_PAGE_MAX),
      isFirstPage: true,
      isLastPage: false,
      pageIndex: 1,
    });
    let remaining = items.slice(FIRST_PAGE_MAX);
    let pageNum = 2;
    while (remaining.length > 0) {
      const isLast = remaining.length <= SUBSEQUENT_PAGE_MAX;
      const chunk = remaining.slice(0, SUBSEQUENT_PAGE_MAX);
      pagesData.push({
        items: chunk,
        isFirstPage: false,
        isLastPage: isLast,
        pageIndex: pageNum,
      });
      remaining = remaining.slice(SUBSEQUENT_PAGE_MAX);
      pageNum++;
    }
  }

  const totalPages = pagesData.length;
  const canvases: HTMLCanvasElement[] = [];

  for (const page of pagesData) {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_WIDTH * SCALE;
    canvas.height = PAGE_HEIGHT * SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.scale(SCALE, SCALE);

    // 1. Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // Warm top border
    ctx.fillStyle = '#F8F7FB';
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    let y = 0;

    // 2. Header
    if (page.isFirstPage) {
      // Purple banner background
      ctx.fillStyle = '#5F259F';
      ctx.fillRect(0, 0, PAGE_WIDTH, 175);

      // Gold accent strip
      ctx.fillStyle = '#D4AF37';
      ctx.fillRect(0, 175, PAGE_WIDTH, 5);

      // Dadaji Portrait circular badge
      const avatarX = 85;
      const avatarY = 88;
      const avatarRadius = 52;

      ctx.save();
      // Outer Gold circle
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius + 4, 0, Math.PI * 2);
      ctx.fillStyle = '#D4AF37';
      ctx.fill();

      // Inner White border
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius + 1, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Circular clip for portrait
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      if (dadajiImg) {
        ctx.drawImage(
          dadajiImg,
          avatarX - avatarRadius,
          avatarY - avatarRadius,
          avatarRadius * 2,
          avatarRadius * 2
        );
      } else {
        // Fallback dignified monogram
        ctx.fillStyle = '#3E1068';
        ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('मुंशी', avatarX, avatarY + 7);
      }
      ctx.restore();

      // Shop Title & Tagline in warm white
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(receipt.shopName, 160, 65);

      // Subline / Blessing
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 15px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.fillText(`✨ ${receipt.ownerBlessing}`, 160, 92);

      // Tagline
      ctx.fillStyle = '#F3E8FF';
      ctx.font = '14px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.fillText(`"${receipt.tagline}"`, 160, 116);

      // Contact/Location
      ctx.fillStyle = '#DDD6FE';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('Kirana & General Store • Cash, UPI & Khata', 160, 138);

      y = 195;
    } else {
      // Continuation Header for subsequent pages
      ctx.fillStyle = '#5F259F';
      ctx.fillRect(0, 0, PAGE_WIDTH, 60);
      ctx.fillStyle = '#D4AF37';
      ctx.fillRect(0, 60, PAGE_WIDTH, 3);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${receipt.shopName} (पेज ${page.pageIndex} / ${totalPages})`, 30, 38);

      y = 75;
    }

    // 3. Receipt Metadata & Status Banners
    if (page.isFirstPage) {
      // White card for metadata
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.roundRect(25, y, PAGE_WIDTH - 50, 75, 12);
      ctx.fill();
      ctx.stroke();

      // Meta left: Receipt Number & Date
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`रसीद संख्या: #${receipt.receiptNumber}`, 40, y + 28);

      ctx.fillStyle = '#64748B';
      ctx.font = '13px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.fillText(`दिनांक: ${receipt.businessDate} • समय: ${receipt.businessTime}`, 40, y + 54);

      // Meta right: Customer Details (if provided)
      ctx.textAlign = 'right';
      if (receipt.customerName) {
        ctx.fillStyle = '#1E293B';
        ctx.font = 'bold 15px "Noto Sans Devanagari", system-ui, sans-serif';
        ctx.fillText(`ग्राहक: ${receipt.customerName}`, PAGE_WIDTH - 40, y + 28);

        ctx.fillStyle = '#64748B';
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText(
          receipt.customerPhone ? `मोबाइल: ${receipt.customerPhone}` : 'नकद ग्राहक (Cash Sale)',
          PAGE_WIDTH - 40,
          y + 54
        );
      } else {
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 14px "Noto Sans Devanagari", system-ui, sans-serif';
        ctx.fillText('काउंटर नकद बिक्री (Counter Cash Sale)', PAGE_WIDTH - 40, y + 42);
      }

      y += 88;

      // VOID / CORRECTED Banner (if applicable)
      if (receipt.isVoided) {
        ctx.fillStyle = '#FEE2E2';
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.roundRect(25, y, PAGE_WIDTH - 50, 38, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#B91C1C';
        ctx.font = 'bold 16px "Noto Sans Devanagari", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`⚠️ रद्द बिल (VOIDED BILL) — कारण: ${receipt.voidReason || 'निरस्त'}`, PAGE_WIDTH / 2, y + 25);
        y += 46;
      } else if (receipt.isCorrected) {
        ctx.fillStyle = '#FEF3C7';
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.roundRect(25, y, PAGE_WIDTH - 50, 38, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#B45309';
        ctx.font = 'bold 16px "Noto Sans Devanagari", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ℹ️ संशोधित बिल (CORRECTED BILL)', PAGE_WIDTH / 2, y + 25);
        y += 46;
      }
    }

    // 4. Table Header
    ctx.fillStyle = '#EDE9FE';
    ctx.fillRect(25, y, PAGE_WIDTH - 50, 36);
    ctx.strokeStyle = '#DDD6FE';
    ctx.strokeRect(25, y, PAGE_WIDTH - 50, 36);

    ctx.fillStyle = '#4C1D95';
    ctx.font = 'bold 13px "Noto Sans Devanagari", system-ui, sans-serif';
    ctx.textAlign = 'left';

    ctx.fillText('#', 38, y + 23);
    ctx.fillText('सामान (Item & Pack)', 75, y + 23);
    ctx.fillText('मात्रा (Qty)', 350, y + 23);
    ctx.fillText('दर (Rate/Unit)', 470, y + 23);
    ctx.textAlign = 'right';
    ctx.fillText('कुल (Amount)', PAGE_WIDTH - 38, y + 23);

    y += 36;

    // 5. Table Rows
    let rowIndex = (page.pageIndex - 1) * FIRST_PAGE_MAX + 1;
    for (const item of page.items) {
      const rowHeight = item.variantLabel ? 44 : 36;

      // Alternating row background
      ctx.fillStyle = rowIndex % 2 === 0 ? '#FBFBFE' : '#FFFFFF';
      ctx.fillRect(25, y, PAGE_WIDTH - 50, rowHeight);
      ctx.strokeStyle = '#F1F5F9';
      ctx.strokeRect(25, y, PAGE_WIDTH - 50, rowHeight);

      // Index
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(String(rowIndex), 38, y + 23);

      // Item Name & Variant
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px "Noto Sans Devanagari", system-ui, sans-serif';
      const nameLines = wrapText(ctx, item.itemName, 260);
      ctx.fillText(nameLines[0] || item.itemName, 75, y + 20);

      if (item.variantLabel) {
        ctx.fillStyle = '#7C3AED';
        ctx.font = '11px "Noto Sans Devanagari", system-ui, sans-serif';
        ctx.fillText(`• ${item.variantLabel}`, 75, y + 36);
      }

      // Quantity & Unit
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.formattedQuantity, 350, y + 23);

      // Rate per Base Unit (Accurate unit e.g. ₹60.00/kg)
      ctx.fillStyle = '#475569';
      ctx.font = '13px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.fillText(item.formattedRate, 470, y + 23);

      // Line Total Amount
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(item.formattedLineTotal, PAGE_WIDTH - 38, y + 23);

      y += rowHeight;
      rowIndex++;
    }

    // 6. Summary / Totals Box (On Last Page)
    if (page.isLastPage) {
      y += 15;

      const summaryWidth = 320;
      const summaryX = PAGE_WIDTH - 25 - summaryWidth;

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.roundRect(summaryX, y, summaryWidth, 140, 12);
      ctx.fill();
      ctx.stroke();

      let sumY = y + 24;

      // Subtotal
      ctx.fillStyle = '#64748B';
      ctx.font = '13px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('सामान कुल (Subtotal):', summaryX + 16, sumY);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(formatINR(receipt.subtotal), summaryX + summaryWidth - 16, sumY);

      // Discount (if any)
      if (receipt.discount > 0) {
        sumY += 22;
        ctx.fillStyle = '#059669';
        ctx.font = '13px "Noto Sans Devanagari", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('छूट (Discount):', summaryX + 16, sumY);
        ctx.textAlign = 'right';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText(`- ${formatINR(receipt.discount)}`, summaryX + summaryWidth - 16, sumY);
      }

      // Grand Total Highlight Bar
      sumY += 26;
      ctx.fillStyle = '#5F259F';
      ctx.roundRect(summaryX + 10, sumY - 18, summaryWidth - 20, 42, 8);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('कुल देय राशि:', summaryX + 22, sumY + 8);
      ctx.textAlign = 'right';
      ctx.font = 'black 22px system-ui, sans-serif';
      ctx.fillText(formatINR(receipt.grandTotal), summaryX + summaryWidth - 22, sumY + 9);

      // Payment Settlement Box on left
      const payWidth = 300;
      const payX = 25;

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#E2E8F0';
      ctx.roundRect(payX, y, payWidth, 140, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 13px "Noto Sans Devanagari", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('भुगतान विवरण (Payment Settlement):', payX + 16, y + 24);

      let pY = y + 48;
      if (receipt.cashReceived > 0) {
        ctx.fillStyle = '#334155';
        ctx.font = '12px "Noto Sans Devanagari", system-ui, sans-serif';
        ctx.fillText(`• नकद प्राप्त (Cash): ${formatINR(receipt.cashReceived)}`, payX + 16, pY);
        if (receipt.changeReturned > 0) {
          ctx.fillStyle = '#059669';
          ctx.fillText(`  (वापस दिए: ${formatINR(receipt.changeReturned)})`, payX + 160, pY);
        }
        pY += 22;
      }
      if (receipt.upiReceived > 0) {
        ctx.fillStyle = '#5B21B6';
        ctx.font = 'bold 12px "Noto Sans Devanagari", system-ui, sans-serif';
        ctx.fillText(`• UPI प्राप्त: ${formatINR(receipt.upiReceived)} (Owner Confirmed)`, payX + 16, pY);
        pY += 22;
      }
      if (receipt.balanceDue > 0) {
        ctx.fillStyle = '#B45309';
        ctx.font = 'bold 13px "Noto Sans Devanagari", system-ui, sans-serif';
        ctx.fillText(`• बाकी उधार (Balance Due): ${formatINR(receipt.balanceDue)}`, payX + 16, pY);
        pY += 22;
      } else if (receipt.balanceDue === 0 && receipt.grandTotal > 0) {
        ctx.fillStyle = '#059669';
        ctx.font = 'bold 12px "Noto Sans Devanagari", system-ui, sans-serif';
        ctx.fillText('• पूरा भुगतान प्राप्त (Fully Paid) ✅', payX + 16, pY);
      }

      y += 155;
    }

    // 7. Footer
    const footerY = PAGE_HEIGHT - 45;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(25, footerY - 15);
    ctx.lineTo(PAGE_WIDTH - 25, footerY - 15);
    ctx.stroke();

    ctx.fillStyle = '#4B5563';
    ctx.font = 'bold 13px "Noto Sans Devanagari", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(receipt.thankYouMessage, PAGE_WIDTH / 2, footerY + 2);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`Page ${page.pageIndex} of ${totalPages} • Munsi Kirana Store`, PAGE_WIDTH / 2, footerY + 20);

    canvases.push(canvas);
  }

  return canvases;
}

/**
 * Generates an actual PNG image file of the receipt
 */
export async function generateReceiptImage(
  receipt: SanitizedReceipt
): Promise<{ blob: Blob; dataUrl: string; file: File }> {
  const canvases = await renderReceiptToCanvas(receipt);
  if (canvases.length === 0) {
    throw new Error('रसीद कैनवास तैयार नहीं हो सका');
  }

  let finalCanvas = canvases[0];

  // If multi-page, stitch vertically for a continuous receipt image
  if (canvases.length > 1) {
    const combined = document.createElement('canvas');
    combined.width = canvases[0].width;
    combined.height = canvases.reduce((acc, c) => acc + c.height, 0);
    const ctx = combined.getContext('2d');
    if (ctx) {
      let offsetY = 0;
      for (const c of canvases) {
        ctx.drawImage(c, 0, offsetY);
        offsetY += c.height;
      }
      finalCanvas = combined;
    }
  }

  const dataUrl = finalCanvas.toDataURL('image/png', 0.92);

  const blob = await new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('कैनवास से इमेज नहीं बन सकी'));
      },
      'image/png',
      0.92
    );
  });

  const fileName = `munsi-receipt-${receipt.receiptNumber.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  return { blob, dataUrl, file };
}

/**
 * Generates an actual, multi-page PDF file with Dadaji's portrait and all fields
 */
export async function generateReceiptPdf(
  receipt: SanitizedReceipt
): Promise<{ blob: Blob; dataUrl: string; file: File }> {
  const canvases = await renderReceiptToCanvas(receipt);
  if (canvases.length === 0) {
    throw new Error('रसीद कैनवास तैयार नहीं हो सका');
  }

  // A4 dimensions in pt (standard portrait: 595.28 x 841.89)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pdfWidth = 595.28;
  const pdfHeight = 841.89;

  for (let i = 0; i < canvases.length; i++) {
    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }
    const imgData = canvases[i].toDataURL('image/jpeg', 0.9);
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
  }

  const blob = pdf.output('blob');
  const dataUrl = URL.createObjectURL(blob);
  const fileName = `munsi-receipt-${receipt.receiptNumber.toLowerCase().replace(/[^a-z0-9]/g, '-')}.pdf`;
  const file = new File([blob], fileName, { type: 'application/pdf' });

  return { blob, dataUrl, file };
}

/**
 * Generates sanitized WhatsApp text matching the receipt fields and accurate rate units
 */
export function generateReceiptText(receipt: SanitizedReceipt): string {
  const lines: string[] = [
    `*${receipt.shopName}*`,
    `✨ _${receipt.ownerBlessing}_`,
    `"${receipt.tagline}"`,
    `--------------------------------`,
    `रसीद संख्या: #${receipt.receiptNumber}`,
    `दिनांक: ${receipt.businessDate} • समय: ${receipt.businessTime}`,
  ];

  if (receipt.customerName) {
    lines.push(`ग्राहक: ${receipt.customerName}`);
  }

  if (receipt.isVoided) {
    lines.push(`⚠️ *[रद्द बिल / VOID BILL: ${receipt.voidReason || 'निरस्त'}]*`);
  }

  lines.push(`--------------------------------`);

  for (const item of receipt.items) {
    const itemTitle = item.variantLabel ? `${item.itemName} (${item.variantLabel})` : item.itemName;
    lines.push(`• *${itemTitle}*: ${item.formattedQuantity} × ${item.formattedRate} = *${item.formattedLineTotal}*`);
  }

  lines.push(`--------------------------------`);
  if (receipt.discount > 0) {
    lines.push(`सामान कुल: ${formatINR(receipt.subtotal)}`);
    lines.push(`छूट: -${formatINR(receipt.discount)}`);
  }
  lines.push(`*कुल राशि (Grand Total): ${formatINR(receipt.grandTotal)}*`);

  if (receipt.cashReceived > 0) {
    lines.push(`नकद प्राप्त: ${formatINR(receipt.cashReceived)}`);
  }
  if (receipt.upiReceived > 0) {
    lines.push(`UPI प्राप्त: ${formatINR(receipt.upiReceived)} (Owner Confirmed)`);
  }
  if (receipt.balanceDue > 0) {
    lines.push(`*बाकी उधार (Balance Due): ${formatINR(receipt.balanceDue)}*`);
  } else if (receipt.grandTotal > 0) {
    lines.push(`स्थिति: पूरा भुगतान प्राप्त (Fully Paid) ✅`);
  }

  lines.push(`--------------------------------`);
  lines.push(`${receipt.thankYouMessage} 🙏`);

  return lines.join('\n');
}
