import React from 'react';
import { X, Lock, FileText, Image as ImageIcon } from 'lucide-react';
import type { Language } from '../i18n';
import { formatINR } from '../domain/money';

export interface InfoModalItem {
  itemName: string;
  variantLabel?: string;
  sellingPrice: number;
  costPrice?: number | null;
  baseUnit: string;
  wholesaleImageUrl?: string;
  notes?: string;
}

interface InfoModalProps {
  item: InfoModalItem | null;
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  item,
  isOpen,
  onClose,
  language,
}) => {
  if (!isOpen || !item) return null;
  const isHi = language === 'hi';

  const marginRupees = item.costPrice != null ? item.sellingPrice - item.costPrice : null;
  const marginPercent =
    item.costPrice != null && item.costPrice > 0
      ? ((marginRupees! / item.costPrice) * 100).toFixed(1)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-mk-line overflow-hidden animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-mk-purple text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-amber-300" />
            </div>
            <h3 className="font-bold text-lg leading-tight">
              {isHi ? 'सामान का गुप्त विवरण' : 'Private Item Details'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          {/* Item Name */}
          <div className="border-b border-mk-line pb-3">
            <h4 className="text-xl font-extrabold text-mk-text leading-snug">
              {item.itemName}
            </h4>
            {item.variantLabel && (
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-mk-soft text-mk-purple text-xs font-bold rounded-lg">
                {item.variantLabel}
              </span>
            )}
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-xs font-semibold text-mk-muted block">
                {isHi ? 'बिक्री दर (Selling Rate)' : 'Selling Price'}
              </span>
              <span className="text-xl font-bold text-mk-text">
                {formatINR(item.sellingPrice)}
              </span>
              <span className="text-xs text-mk-muted ml-1">/{item.baseUnit}</span>
            </div>

            <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-100">
              <span className="text-xs font-semibold text-amber-800 block flex items-center gap-1">
                <Lock className="w-3 h-3" />
                {isHi ? 'खरीद लागत (Cost)' : 'Purchase Cost'}
              </span>
              <span className="text-xl font-bold text-amber-900">
                {item.costPrice != null ? formatINR(item.costPrice) : isHi ? 'अज्ञात' : 'N/A'}
              </span>
              {item.costPrice != null && (
                <span className="text-xs text-amber-700 ml-1">/{item.baseUnit}</span>
              )}
            </div>
          </div>

          {/* Margin Estimation */}
          {marginRupees != null && (
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800">
                {isHi ? 'अनुमानित मुनाफा (Profit)' : 'Estimated Margin'}
              </span>
              <span className="text-base font-bold text-emerald-700">
                +{formatINR(marginRupees)} ({marginPercent}%)
              </span>
            </div>
          )}

          {/* Wholesale Bill Photo */}
          <div>
            <span className="text-xs font-bold text-mk-muted uppercase tracking-wider block mb-2">
              {isHi ? 'थोक बिल पर्ची फोटो' : 'Wholesale Bill Receipt'}
            </span>

            {item.wholesaleImageUrl ? (
              <div className="rounded-2xl overflow-hidden border border-mk-line bg-slate-100 relative group">
                <img
                  src={item.wholesaleImageUrl}
                  alt="Wholesale Bill"
                  className="w-full h-44 object-contain bg-white"
                />
                <a
                  href={item.wholesaleImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute bottom-2 right-2 px-3 py-1 bg-black/70 hover:bg-black text-white text-xs font-semibold rounded-lg shadow"
                >
                  {isHi ? 'बड़ा देखें' : 'View Full'}
                </a>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-slate-400">
                <ImageIcon className="w-8 h-8 mx-auto mb-1 stroke-1" />
                <span className="text-xs block">
                  {isHi ? 'कोई थोक बिल पर्ची संलग्न नहीं है' : 'No wholesale photo attached'}
                </span>
              </div>
            )}
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-touch bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-mk-text font-bold rounded-2xl transition-colors"
          >
            {isHi ? 'बंद करें (Close)' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

