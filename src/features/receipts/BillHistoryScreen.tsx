import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Share2,
  Printer,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import type { Language } from '../../i18n';
import { translations } from '../../i18n';
import { db } from '../../data/db';
import type { Bill } from '../../domain/billing';
import { formatINR } from '../../domain/money';
import { buildBillWhatsAppLink } from '../../integrations/whatsapp';

interface BillHistoryScreenProps {
  language: Language;
}

export const BillHistoryScreen: React.FC<BillHistoryScreenProps> = ({ language }) => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const t = translations[language];
  const isHi = language === 'hi';

  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Void Modal
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const loadBills = async () => {
    const all = await db.bills.orderBy('createdAt').reverse().toArray();
    setBills(all);
    if (id) {
      const found = all.find((b) => b.id === id);
      if (found) setSelectedBill(found);
    }
  };

  useEffect(() => {
    loadBills();
  }, [id]);

  const filteredBills = bills.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      b.receiptNumber.toLowerCase().includes(q) ||
      b.businessDate.includes(q) ||
      (b.settlement.customerName && b.settlement.customerName.toLowerCase().includes(q))
    );
  });

  const handleVoidBill = async () => {
    if (!selectedBill || !voidReason.trim()) {
      alert('कृपया बिल रद्द करने का कारण दर्ज करें');
      return;
    }

    await db.transaction('rw', [db.bills, db.credit_charges], async () => {
      // 1. Mark bill voided
      await db.bills.update(selectedBill.id, {
        status: 'voided',
        voidReason: voidReason.trim(),
      });

      // 2. If bill had credit due, reverse linked charge
      if (selectedBill.settlement.creditDue > 0) {
        const linkedCharges = await db.credit_charges
          .where('linkedBillId')
          .equals(selectedBill.id)
          .toArray();

        for (const c of linkedCharges) {
          await db.credit_charges.update(c.id, { isReversed: true });
        }
      }
    });

    setIsVoidModalOpen(false);
    setVoidReason('');
    await loadBills();
    const updated = await db.bills.get(selectedBill.id);
    if (updated) setSelectedBill(updated);
  };

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => (selectedBill ? setSelectedBill(null) : navigate('/'))}
            className="w-11 h-11 rounded-2xl bg-white border border-mk-line flex items-center justify-center text-mk-text hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-mk-text leading-tight">
              {selectedBill ? `बिल #${selectedBill.receiptNumber}` : isHi ? 'बिल इतिहास' : 'Bill History'}
            </h2>
            <p className="text-xs text-mk-muted mt-0.5">
              {selectedBill ? selectedBill.businessDate : `${bills.length} ${isHi ? 'बिल दर्ज' : 'bills recorded'}`}
            </p>
          </div>
        </div>
      </div>

      {/* Detail View of Selected Bill */}
      {selectedBill ? (
        <div className="bg-white rounded-3xl border border-mk-line shadow-sm p-5 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
            <div>
              <span className="text-xs text-mk-muted font-bold block">{t.receiptNo}</span>
              <span className="text-lg font-black text-mk-text">#{selectedBill.receiptNumber}</span>
            </div>
            <div className="text-right">
              <span
                className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                  selectedBill.status === 'voided'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {selectedBill.status === 'voided' ? (isHi ? 'रद्द (Voided)' : 'Voided') : (isHi ? 'पूर्ण (Completed)' : 'Completed')}
              </span>
            </div>
          </div>

          {selectedBill.status === 'voided' && selectedBill.voidReason && (
            <div className="p-3 bg-red-50 rounded-2xl border border-red-200 text-xs font-bold text-red-700">
              रद्द करने का कारण: {selectedBill.voidReason}
            </div>
          )}

          {/* Items List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-mk-muted uppercase tracking-wider">
              {isHi ? 'सामान सूची' : 'Line Items'}
            </h4>
            <div className="space-y-2 divide-y divide-slate-100 text-sm">
              {selectedBill.items.map((it) => (
                <div key={it.id} className="pt-2 flex justify-between items-center">
                  <div>
                    <span className="font-extrabold text-mk-text block">{it.itemName}</span>
                    <span className="text-xs text-mk-muted">
                      {it.quantity} {it.billingUnit} × ₹{it.ratePerBaseUnit}
                    </span>
                  </div>
                  <span className="font-black text-mk-text">{formatINR(it.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bill Totals */}
          <div className="pt-3 border-t-2 border-slate-900 space-y-1 text-sm">
            <div className="flex justify-between text-lg font-black text-mk-text">
              <span>{t.grandTotal}</span>
              <span>{formatINR(selectedBill.grandTotal)}</span>
            </div>

            <div className="pt-2 border-t border-dashed border-slate-200 text-xs space-y-1">
              {selectedBill.settlement.cashReceived > 0 && (
                <div className="flex justify-between text-mk-muted font-bold">
                  <span>नकद प्राप्त:</span>
                  <span>{formatINR(selectedBill.settlement.cashReceived)}</span>
                </div>
              )}
              {selectedBill.settlement.upiReceived > 0 && (
                <div className="flex justify-between text-mk-muted font-bold">
                  <span>UPI प्राप्त:</span>
                  <span>{formatINR(selectedBill.settlement.upiReceived)}</span>
                </div>
              )}
              {selectedBill.settlement.creditDue > 0 && (
                <div className="flex justify-between text-amber-700 font-black">
                  <span>बाकी उधार:</span>
                  <span>{formatINR(selectedBill.settlement.creditDue)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={() => {
                const link = buildBillWhatsAppLink(
                  selectedBill,
                  selectedBill.settlement.customerPhone,
                  'मुंशी किराना स्टोर'
                );
                if (link.url) window.open(link.url, '_blank');
              }}
              className="w-full min-h-touch bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-2 shadow"
            >
              <Share2 className="w-5 h-5" />
              <span>{t.sendWhatsApp}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full min-h-touch bg-slate-100 hover:bg-slate-200 text-mk-text font-bold text-sm rounded-2xl flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>{t.printOrPdf}</span>
            </button>

            {selectedBill.status !== 'voided' && (
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(true)}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm rounded-2xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>बिल रद्द करें (Void Bill)</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* History Search & List */
        <div className="space-y-3">
          <div className="bg-white p-2.5 rounded-2xl border border-mk-line shadow-sm flex items-center gap-2">
            <Search className="w-5 h-5 text-mk-muted flex-shrink-0 ml-1" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isHi ? 'रसीद संख्या या तारीख से खोजें...' : 'Search receipt number or date...'}
              className="w-full bg-transparent font-semibold text-sm text-mk-text focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            {filteredBills.map((b) => (
              <div
                key={b.id}
                onClick={() => setSelectedBill(b)}
                className="p-4 rounded-3xl bg-white border border-mk-line shadow-sm hover:bg-slate-50 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between"
              >
                <div>
                  <h4 className="font-extrabold text-base text-mk-text">
                    #{b.receiptNumber}
                  </h4>
                  <p className="text-xs text-mk-muted mt-0.5">
                    {b.businessDate} • {b.items.length} {isHi ? 'सामान' : 'items'}
                    {b.settlement.customerName && ` • ${b.settlement.customerName}`}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-lg font-black text-mk-text block">
                    {formatINR(b.grandTotal)}
                  </span>
                  <span
                    className={`text-[11px] font-bold uppercase ${
                      b.status === 'voided'
                        ? 'text-red-600'
                        : b.settlement.creditDue > 0
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {b.status === 'voided' ? 'रद्द' : b.settlement.method}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {isVoidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-extrabold text-lg">बिल रद्द करने की पुष्टि करें</h3>
            </div>
            <p className="text-xs text-mk-muted leading-relaxed">
              यह बिल बिक्री रिपोर्ट से हटा दिया जाएगा तथा यदि कोई उधारी जुड़ी थी तो वह भी स्वतः निरस्त हो जाएगी।
            </p>
            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">रद्द करने का कारण *</label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="उदा. ग्राहक ने सामान लौटा दिया"
                className="w-full min-h-[46px] px-3 font-bold text-sm rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 font-bold rounded-2xl"
              >
                कैंसल
              </button>
              <button
                type="button"
                onClick={handleVoidBill}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-2xl shadow"
              >
                बिल रद्द करें
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

