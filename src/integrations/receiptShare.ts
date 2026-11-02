import type { SanitizedReceipt } from '../domain/receipt';
import { generateReceiptText } from './receiptRenderer';
import { normalizeIndianPhone } from './whatsapp';

export interface ShareResult {
  success: boolean;
  method: 'web-share' | 'download';
  cancelled?: boolean;
  message?: string;
  error?: string;
}

/**
 * Checks whether the current browser supports sharing files via the Web Share API
 */
export function canBrowserShareFiles(file?: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  if (typeof navigator.canShare !== 'function') {
    return false;
  }
  if (!file) {
    const dummy = new File([''], 'test.png', { type: 'image/png' });
    try {
      return navigator.canShare({ files: [dummy] });
    } catch {
      return false;
    }
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Triggers an immediate browser file download fallback
 */
export function downloadFileLocally(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

/**
 * Shares a receipt file (Image or PDF) using Web Share API when supported,
 * or gracefully falls back to instant file download with manual WhatsApp instructions.
 */
export async function shareReceiptFile(
  file: File,
  receipt: SanitizedReceipt
): Promise<ShareResult> {
  if (canBrowserShareFiles(file)) {
    try {
      await navigator.share({
        files: [file],
        title: `रसीद #${receipt.receiptNumber} — मुंशी किराना स्टोर`,
        text: `मुंशी किराना स्टोर (${receipt.businessDate}) रसीद #${receipt.receiptNumber}`,
      });
      return {
        success: true,
        method: 'web-share',
        message: 'शेयरिंग विंडो खोली गई। (नोट: कृपया सूची में से ग्राहक चुनें)',
      };
    } catch (err: any) {
      // AbortError indicates the user dismissed the system share sheet
      if (err.name === 'AbortError') {
        return {
          success: false,
          method: 'web-share',
          cancelled: true,
          message: 'शेयरिंग रद्द की गई',
        };
      }
      // If Web Share failed for another reason, fallback to download
      downloadFileLocally(file);
      return {
        success: true,
        method: 'download',
        message: 'डायरेक्ट शेयर असफल होने के कारण रसीद डाउनलोड कर दी गई है। कृपया WhatsApp में अटैच करें।',
      };
    }
  }

  // Unsupported browser fallback
  downloadFileLocally(file);
  return {
    success: true,
    method: 'download',
    message: 'आपके ब्राउज़र में डायरेक्ट फाइल शेयर समर्थित नहीं है। रसीद डाउनलोड हो गई है।',
  };
}

/**
 * Copies a string to clipboard with mobile browser fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * Builds separate URL for "Send text in WhatsApp" option
 */
export function buildWhatsAppTextShareUrl(
  receipt: SanitizedReceipt,
  customerPhone?: string,
  publicReceiptUrl?: string
): { url: string; isPhoneValid: boolean; formattedPhone?: string } {
  const norm = normalizeIndianPhone(customerPhone || receipt.customerPhone);
  let text = generateReceiptText(receipt);

  if (publicReceiptUrl) {
    text += `\n\nडिजिटल रसीद लिंक: ${publicReceiptUrl}`;
  }

  const encoded = encodeURIComponent(text);
  const url = norm.valid && norm.normalized
    ? `https://wa.me/${norm.normalized}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  return {
    url,
    isPhoneValid: norm.valid,
    formattedPhone: norm.display,
  };
}
