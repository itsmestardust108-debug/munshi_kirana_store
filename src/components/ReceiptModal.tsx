import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Download,
  Printer,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { Language } from '../i18n';
import { translations } from '../i18n';
import type { Bill } from '../domain/billing';
import type { SanitizedReceipt } from '../domain/receipt';
import { buildSanitizedReceipt } from '../domain/receipt';
import {
  generateReceiptImage,
  generateReceiptPdf,
} from '../integrations/receiptRenderer';
import {
  shareReceiptFile,
  downloadFileLocally,
  copyToClipboard,
  buildWhatsAppTextShareUrl,
  canBrowserShareFiles,
} from '../integrations/receiptShare';
import { formatINR } from '../domain/money';

interface ReceiptModalProps {
  bill: Bill | null;
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  publicShareUrl?: string;
  onNewBill?: () => void;
  isOwnerConfirmedTagline?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  bill,
  isOpen,
  onClose,
  language,
  publicShareUrl,
  onNewBill,
  isOwnerConfirmedTagline = false,
}) => {
  const t = translations[language];
  const isHi = language === 'hi';

  const [receipt, setReceipt] = useState<SanitizedReceipt | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'info' | 'success' | 'warn' } | null>(null);

  // Cached files to preserve user activation for Web Share API
  const [cachedImageFile, setCachedImageFile] = useState<File | null>(null);
  const [cachedPdfFile, setCachedPdfFile] = useState<File | null>(null);

  useEffect(() => {
    if (!bill) {
      setReceipt(null);
      setCachedImageFile(null);
      setCachedPdfFile(null);
      setActionNotice(null);
      return;
    }

    const sanitized = buildSanitizedReceipt(bill, null, {
      isHindi: isHi,
      useOwnerConfirmedTagline: isOwnerConfirmedTagline,
    });
    setReceipt(sanitized);

    // Pre-generate image and PDF in background so navigator.share user activation isn't lost
    let isCancelled = false;
    async function preheatFiles() {
      try {
        const { file: imgFile } = await generateReceiptImage(sanitized);
        if (!isCancelled) setCachedImageFile(imgFile);

        const { file: pdfFile } = await generateReceiptPdf(sanitized);
        if (!isCancelled) setCachedPdfFile(pdfFile);
      } catch (e) {
        console.warn('Receipt file pre-generation postponed:', e);
      }
    }

    preheatFiles();
    return () => {
      isCancelled = true;
    };
  }, [bill, isHi, isOwnerConfirmedTagline]);

  if (!isOpen || !bill || !receipt) return null;

  // 1. Share Image
  const handleShareImage = async () => {
    if (!receipt) return;
    setIsGenerating(true);
    setActionNotice({ text: 'फोटो तैयार हो रही है...', type: 'info' });

    try {
      let fileToShare = cachedImageFile;
      if (!fileToShare) {
        const res = await generateReceiptImage(receipt);
        fileToShare = res.file;
        setCachedImageFile(fileToShare);
      }

      const shareRes = await shareReceiptFile(fileToShare, receipt);
      if (shareRes.success) {
        setActionNotice({
          text: shareRes.message || 'फोटो शेयरिंग विंडो खुल गई है',
          type: 'success',
        });
      } else if (shareRes.cancelled) {
        setActionNotice({ text: 'शेयरिंग रद्द की गई', type: 'info' });
      } else {
        setActionNotice({ text: shareRes.message || 'शेयर नहीं हो सका', type: 'warn' });
      }
    } catch (err: any) {
      setActionNotice({ text: err.message || 'इमेज शेयर करने में समस्या आई', type: 'warn' });
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Share PDF
  const handleSharePdf = async () => {
    if (!receipt) return;
    setIsGenerating(true);
    setActionNotice({ text: 'PDF तैयार हो रहा है...', type: 'info' });

    try {
      let fileToShare = cachedPdfFile;
      if (!fileToShare) {
        const res = await generateReceiptPdf(receipt);
        fileToShare = res.file;
        setCachedPdfFile(fileToShare);
      }

      const shareRes = await shareReceiptFile(fileToShare, receipt);
      if (shareRes.success) {
        setActionNotice({
          text: shareRes.message || 'PDF शेयरिंग विंडो खुल गई है',
          type: 'success',
        });
      } else if (shareRes.cancelled) {
        setActionNotice({ text: 'शेयरिंग रद्द की गई', type: 'info' });
      } else {
        setActionNotice({ text: shareRes.message || 'शेयर नहीं हो सका', type: 'warn' });
      }
    } catch (err: any) {
      setActionNotice({ text: err.message || 'PDF शेयर करने में समस्या आई', type: 'warn' });
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Download Image
  const handleDownloadImage = async () => {
    if (!receipt) return;
    setIsGenerating(true);
    try {
      let fileToDownload = cachedImageFile;
      if (!fileToDownload) {
        const res = await generateReceiptImage(receipt);
        fileToDownload = res.file;
        setCachedImageFile(fileToDownload);
      }
      downloadFileLocally(fileToDownload);
      setActionNotice({ text: 'रसीद फोटो डाउनलोड हो गई है ✅', type: 'success' });
    } catch (err: any) {
      setActionNotice({ text: err.message || 'फोटो डाउनलोड विफल', type: 'warn' });
    } finally {
      setIsGenerating(false);
    }
  };

  // 4. Download PDF
  const handleDownloadPdf = async () => {
    if (!receipt) return;
    setIsGenerating(true);
    try {
      let fileToDownload = cachedPdfFile;
      if (!fileToDownload) {
        const res = await generateReceiptPdf(receipt);
        fileToDownload = res.file;
        setCachedPdfFile(fileToDownload);
      }
      downloadFileLocally(fileToDownload);
      setActionNotice({ text: 'रसीद PDF डाउनलोड हो गया है ✅', type: 'success' });
    } catch (err: any) {
      setActionNotice({ text: err.message || 'PDF डाउनलोड विफल', type: 'warn' });
    } finally {
      setIsGenerating(false);
    }
  };

  // 5. Send Text in WhatsApp
  const handleSendTextWhatsApp = () => {
    if (!receipt) return;
    const { url } = buildWhatsAppTextShareUrl(receipt, receipt.customerPhone, publicShareUrl);
    window.open(url, '_blank');
  };

  // 6. Copy Phone
  const handleCopyPhone = async () => {
    if (!receipt.customerPhone) return;
    const ok = await copyToClipboard(receipt.customerPhone);
    if (ok) {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-mk-line overflow-hidden my-auto flex flex-col max-h-[95vh]">
        {/* Top Bar with Close */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400 stroke-[2.5]" />
            <h3 className="font-extrabold text-base tracking-wide">
              {isHi ? 'डिजिटल पक्की रसीद (Receipt Preview)' : 'Digital Sales Receipt'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Receipt Preview Area */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50">
          {/* Branded Card Header */}
          <div className="bg-white rounded-3xl border border-mk-line shadow-sm overflow-hidden">
            {/* Purple Banner with Dadaji Photo */}
            <div className="bg-mk-purple p-4 sm:p-5 text-white relative">
              <div className="flex items-center gap-3.5">
                {/* Tasteful Circular Portrait with Gold Accent */}
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-mk-purple overflow-hidden shadow-md bg-white">
                    <img
                      src={receipt.photoUrl}
                      alt="श्री मुंशी सेठ जी"
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>

                {/* Shop Name & Dedication */}
                <div className="space-y-0.5">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                    {receipt.shopName}
                  </h2>
                  <p className="text-xs sm:text-sm font-bold text-amber-300">
                    ✨ {receipt.ownerBlessing}
                  </p>
                  <p className="text-[11px] sm:text-xs text-purple-200 italic">
                    "{receipt.tagline}"
                  </p>
                </div>
              </div>

              {/* Status Ribbon (if voided or corrected) */}
              {receipt.isVoided && (
                <div className="mt-3 py-1.5 px-3 bg-red-600 text-white rounded-xl text-center text-xs font-black uppercase tracking-wider">
                  ⚠️ रद्द बिल (VOIDED BILL) {receipt.voidReason ? `— ${receipt.voidReason}` : ''}
                </div>
              )}
              {receipt.isCorrected && (
                <div className="mt-3 py-1.5 px-3 bg-amber-500 text-slate-900 rounded-xl text-center text-xs font-black uppercase tracking-wider">
                  ℹ️ संशोधित बिल (CORRECTED BILL)
                </div>
              )}
            </div>

            {/* Receipt Meta Details */}
            <div className="p-4 bg-slate-50/70 border-b border-mk-line text-xs font-semibold text-mk-muted flex flex-wrap justify-between items-center gap-2">
              <div>
                <span className="block font-bold text-mk-text text-sm">
                  #{receipt.receiptNumber}
                </span>
                <span>{receipt.businessDate} • {receipt.businessTime}</span>
              </div>
              <div className="text-right">
                <span className="block font-bold text-mk-text text-sm">
                  {receipt.customerName || 'नकद काउंटर बिक्री'}
                </span>
                <span>{receipt.customerPhone ? `फोन: ${receipt.customerPhone}` : 'Cash Sale'}</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-mk-muted font-bold pb-2">
                    <th className="pb-2">सामान</th>
                    <th className="pb-2 text-center">मात्रा</th>
                    <th className="pb-2 text-center">दर</th>
                    <th className="pb-2 text-right">कुल</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipt.items.map((it, idx) => (
                    <tr key={it.id || idx} className="py-2">
                      <td className="py-2 pr-2 font-bold text-mk-text">
                        <div>{it.itemName}</div>
                        {it.variantLabel && (
                          <div className="text-[11px] font-semibold text-mk-purple">
                            • {it.variantLabel}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-1 text-center font-bold text-slate-700 whitespace-nowrap">
                        {it.formattedQuantity}
                      </td>
                      <td className="py-2 px-1 text-center text-slate-600 whitespace-nowrap">
                        {it.formattedRate}
                      </td>
                      <td className="py-2 pl-2 text-right font-black text-mk-text whitespace-nowrap">
                        {it.formattedLineTotal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals & Settlement Box */}
              <div className="mt-4 pt-3 border-t-2 border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between font-semibold text-mk-muted">
                  <span>सामान कुल (Subtotal):</span>
                  <span className="font-bold text-mk-text">{formatINR(receipt.subtotal)}</span>
                </div>

                {receipt.discount > 0 && (
                  <div className="flex justify-between font-semibold text-emerald-600">
                    <span>छूट (Discount):</span>
                    <span className="font-bold">- {formatINR(receipt.discount)}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-base font-black text-mk-text">कुल देय (Grand Total):</span>
                  <span className="text-2xl font-black text-mk-purple">{formatINR(receipt.grandTotal)}</span>
                </div>

                {/* Settlement summary */}
                <div className="mt-2 p-2.5 rounded-2xl bg-purple-50/60 border border-purple-100 text-[11px] font-semibold text-mk-text space-y-1">
                  <div className="font-bold text-mk-purple uppercase text-[10px] tracking-wider">
                    भुगतान विवरण (Settlement)
                  </div>
                  {receipt.cashReceived > 0 && (
                    <div className="flex justify-between">
                      <span>नकद प्राप्त:</span>
                      <span className="font-bold">
                        {formatINR(receipt.cashReceived)}
                        {receipt.changeReturned > 0 && ` (वापस: ${formatINR(receipt.changeReturned)})`}
                      </span>
                    </div>
                  )}
                  {receipt.upiReceived > 0 && (
                    <div className="flex justify-between text-mk-purple font-bold">
                      <span>UPI प्राप्त (Owner Verified):</span>
                      <span>{formatINR(receipt.upiReceived)}</span>
                    </div>
                  )}
                  {receipt.balanceDue > 0 ? (
                    <div className="flex justify-between text-amber-700 font-black text-xs pt-1 border-t border-purple-200/50">
                      <span>बाकी उधार (Balance Due):</span>
                      <span>{formatINR(receipt.balanceDue)}</span>
                    </div>
                  ) : (
                    <div className="text-emerald-700 font-bold text-right pt-0.5">
                      पूर्ण भुगतान प्राप्त (Fully Paid) ✅
                    </div>
                  )}
                </div>

                <p className="pt-2 text-center text-[11px] font-bold text-slate-500">
                  {receipt.thankYouMessage}
                </p>
              </div>
            </div>
          </div>

          {/* Customer Number Quick-Copy Helper (for WhatsApp) */}
          {receipt.customerPhone && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-amber-800 font-bold block">
                  ग्राहक मोबाइल: {receipt.customerPhone}
                </span>
                <span className="text-amber-700 text-[11px]">
                  WhatsApp में सीधे फाइल भेजते समय ग्राहक को खोजने के लिए नंबर कॉपी करें
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="min-h-[42px] px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-900 font-black rounded-xl flex items-center gap-1.5 flex-shrink-0 transition-all"
              >
                {copiedPhone ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPhone ? 'कॉपी हुआ' : 'कॉपी करें'}</span>
              </button>
            </div>
          )}

          {/* Action Notice feedback */}
          {actionNotice && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                actionNotice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : actionNotice.type === 'warn'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{actionNotice.text}</span>
            </div>
          )}
        </div>

        {/* Action Controls Toolbar (>= 56px touch height) */}
        <div className="p-4 bg-white border-t border-mk-line space-y-2.5">
          {/* Primary Share Buttons Row */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleShareImage}
              className="min-h-touch bg-[#25D366] hover:bg-[#20bd5a] active:bg-[#1caa4f] disabled:opacity-50 text-white font-extrabold text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all"
            >
              <ImageIcon className="w-5 h-5 stroke-[2.5]" />
              <span>{isGenerating ? 'तैयार हो रहा...' : 'फोटो शेयर करें'}</span>
            </button>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleSharePdf}
              className="min-h-touch bg-mk-purple hover:bg-mk-purple-dark active:bg-purple-950 disabled:opacity-50 text-white font-extrabold text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-purple-900/20 active:scale-[0.98] transition-all"
            >
              <FileText className="w-5 h-5 stroke-[2.5]" />
              <span>{isGenerating ? 'तैयार हो रहा...' : 'PDF शेयर करें'}</span>
            </button>
          </div>

          {/* Secondary Actions: Downloads, Print, Text WhatsApp */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleDownloadImage}
              className="min-h-[46px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>फोटो डाउनलोड</span>
            </button>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleDownloadPdf}
              className="min-h-[46px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>PDF डाउनलोड</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[46px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>प्रिंट (Print)</span>
            </button>
          </div>

          {/* Send text on WhatsApp (Separate honest option) */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSendTextWhatsApp}
              className="flex-1 min-h-[46px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp पर केवल टेक्स्ट विवरण भेजें</span>
            </button>

            {onNewBill && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewBill();
                }}
                className="px-4 min-h-[46px] bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl transition-colors"
              >
                {t.newBillBtn || 'नया बिल'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
