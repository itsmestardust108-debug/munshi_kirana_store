import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Share2,
  PlusCircle,
  CheckCircle,
  RotateCcw,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { Language } from '../../i18n';
import { translations } from '../../i18n';
import { db } from '../../data/db';
import type { Customer, CreditCharge, Repayment, LedgerReversal, CustomerLedgerSummary } from '../../domain/ledger';
import { buildCustomerLedgerSummary } from '../../domain/ledger';
import { formatINR } from '../../domain/money';
import { getTodayKolkataDate } from '../../domain/interest';
import { buildLedgerReminderWhatsAppLink } from '../../integrations/whatsapp';

interface CustomerStatementScreenProps {
  language: Language;
}

export const CustomerStatementScreen: React.FC<CustomerStatementScreenProps> = ({ language }) => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const t = translations[language];
  const isHi = language === 'hi';

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [summary, setSummary] = useState<CustomerLedgerSummary | null>(null);

  // Modals
  const [isAddChargeOpen, setIsAddChargeOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeReason, setChargeReason] = useState('');
  const [chargeDueDate, setChargeDueDate] = useState('');

  const [isAddRepaymentOpen, setIsAddRepaymentOpen] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState<'cash' | 'upi'>('cash');
  const [repayNotes, setRepayNotes] = useState('');

  // Reversal Modal
  const [isReversalOpen, setIsReversalOpen] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<{ id: string; type: 'charge' | 'repayment' } | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const loadCustomerData = async () => {
    if (!customerId) return;
    const cust = await db.customers.get(customerId);
    if (!cust) return;

    const charges = await db.credit_charges.where('customerId').equals(customerId).toArray();
    const repayments = await db.repayments.where('customerId').equals(customerId).toArray();
    const reversals = await db.ledger_reversals.toArray();

    const summ = buildCustomerLedgerSummary(cust, charges, repayments, reversals);
    setCustomer(cust);
    setSummary(summ);
  };

  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

  const handleSaveCharge = async () => {
    const amt = parseFloat(chargeAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('कृपया मान्य राशि दर्ज करें');
      return;
    }

    const todayStr = getTodayKolkataDate();
    await db.credit_charges.add({
      id: `charge-${Date.now()}`,
      shopId: 'demo-munsi-kirana-001',
      customerId: customer!.id,
      amount: amt,
      transactionDate: todayStr,
      reasonNotes: chargeReason.trim() || undefined,
      dueDate: chargeDueDate.trim() || undefined,
      isReversed: false,
      createdAt: new Date().toISOString(),
    });

    setIsAddChargeOpen(false);
    setChargeAmount('');
    setChargeReason('');
    setChargeDueDate('');
    await loadCustomerData();
  };

  const handleSaveRepayment = async () => {
    const amt = parseFloat(repayAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('कृपया मान्य राशि दर्ज करें');
      return;
    }

    const todayStr = getTodayKolkataDate();
    await db.repayments.add({
      id: `repay-${Date.now()}`,
      shopId: 'demo-munsi-kirana-001',
      customerId: customer!.id,
      amount: amt,
      paymentDate: todayStr,
      method: repayMethod,
      notes: repayNotes.trim() || undefined,
      idempotentOpId: `op-repay-${Date.now()}`,
      isReversed: false,
      createdAt: new Date().toISOString(),
    });

    setIsAddRepaymentOpen(false);
    setRepayAmount('');
    setRepayNotes('');
    await loadCustomerData();
  };

  const handleConfirmReversal = async () => {
    if (!reversalTarget || !reversalReason.trim()) {
      alert('कृपया रद्द करने का कारण लिखें');
      return;
    }

    await db.ledger_reversals.add({
      id: `rev-${Date.now()}`,
      shopId: 'demo-munsi-kirana-001',
      targetType: reversalTarget.type,
      targetId: reversalTarget.id,
      reason: reversalReason.trim(),
      createdAt: new Date().toISOString(),
    });

    setIsReversalOpen(false);
    setReversalTarget(null);
    setReversalReason('');
    await loadCustomerData();
  };

  if (!customer || !summary) {
    return (
      <div className="p-4 text-center text-mk-muted">
        {isHi ? 'ग्राहक लोड हो रहा है...' : 'Loading customer...'}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/ledger')}
            className="w-11 h-11 rounded-2xl bg-white border border-mk-line flex items-center justify-center text-mk-text hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-mk-text leading-tight">
              {customer.name}
            </h2>
            {customer.phone && (
              <p className="text-xs text-mk-muted mt-0.5">{customer.phone}</p>
            )}
          </div>
        </div>

        {summary.outstandingBalance.greaterThan(0) && (
          <button
            type="button"
            onClick={() => {
              const link = buildLedgerReminderWhatsAppLink(
                customer.name,
                customer.phone,
                summary.outstandingBalance.toNumber(),
                'मुंशी किराना स्टोर'
              );
              if (link.url) window.open(link.url, '_blank');
            }}
            className="p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            title={t.sendReminderWhatsApp}
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs font-bold">तगादा</span>
          </button>
        )}
      </div>

      {/* Customer Balance Summary Card */}
      <div className="p-5 bg-white rounded-3xl border border-mk-line shadow-sm space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold text-mk-muted uppercase tracking-wider">
            {t.balanceDueLabel}
          </span>
          <span
            className={`text-3xl font-black ${
              summary.outstandingBalance.greaterThan(0) ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {formatINR(summary.outstandingBalance)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
          <div>
            <span className="text-mk-muted block">{isHi ? 'कुल उधार:' : 'Total Charges:'}</span>
            <span className="font-bold text-base text-mk-text">{formatINR(summary.totalCharges)}</span>
          </div>
          <div className="text-right">
            <span className="text-mk-muted block">{isHi ? 'कुल भुगतान मिला:' : 'Total Repaid:'}</span>
            <span className="font-bold text-base text-emerald-700">
              {formatINR(summary.totalRepayments)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons: Add Credit & Record Payment */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setIsAddChargeOpen(true)}
          className="min-h-touch bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-base rounded-2xl shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <PlusCircle className="w-5 h-5 stroke-[2.5]" />
          <span>{t.addUdhaarBtn}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsAddRepaymentOpen(true)}
          className="min-h-touch bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-base rounded-2xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <CheckCircle className="w-5 h-5 stroke-[2.5]" />
          <span>{t.repaymentReceivedBtn}</span>
        </button>
      </div>

      {/* Account Statement Timeline */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold text-mk-muted uppercase tracking-wider px-1">
          {t.statement} ({summary.statement.length})
        </h3>

        {summary.statement.length === 0 ? (
          <div className="p-6 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-slate-400">
            <p className="text-sm font-medium">{isHi ? 'अभी कोई लेन-देन नहीं है' : 'No transactions yet'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {summary.statement.map((entry) => (
              <div
                key={entry.id}
                className={`p-3.5 rounded-2xl bg-white border shadow-sm flex items-center justify-between gap-3 ${
                  entry.isReversed ? 'opacity-60 bg-slate-50 border-dashed border-slate-300' : 'border-mk-line'
                }`}
              >
                <div>
                  <h4 className="font-bold text-sm text-mk-text">{entry.description}</h4>
                  <p className="text-[11px] text-mk-muted mt-0.5">{entry.date}</p>
                </div>

                <div className="text-right flex items-center gap-2">
                  <div>
                    {entry.debit.greaterThan(0) ? (
                      <span className="text-base font-black text-amber-800 block">
                        +{formatINR(entry.debit)}
                      </span>
                    ) : (
                      <span className="text-base font-black text-emerald-700 block">
                        -{formatINR(entry.credit)}
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-mk-muted">
                      {isHi ? 'बाकी:' : 'Bal:'} {formatINR(entry.runningBalance)}
                    </span>
                  </div>

                  {!entry.isReversed && (
                    <button
                      type="button"
                      onClick={() => {
                        setReversalTarget({ id: entry.id, type: entry.type as any });
                        setIsReversalOpen(true);
                      }}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                      title={t.reversalBtn}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Udhaar Modal */}
      {isAddChargeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4">
            <h3 className="font-extrabold text-lg text-mk-text">{t.addUdhaarBtn}</h3>
            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">उधार राशि (₹) *</label>
              <input
                type="number"
                step="1"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[48px] px-3 font-extrabold text-xl rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">सामान या कारण</label>
              <input
                type="text"
                value={chargeReason}
                onChange={(e) => setChargeReason(e.target.value)}
                placeholder="उदा. किराना सामान, तेल, दाल"
                className="w-full min-h-[46px] px-3 font-bold text-sm rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">चुकता करने की तय तारीख (वैकल्पिक)</label>
              <input
                type="text"
                value={chargeDueDate}
                onChange={(e) => setChargeDueDate(e.target.value)}
                placeholder="DD-MM-YYYY"
                className="w-full min-h-[46px] px-3 font-bold text-sm rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddChargeOpen(false)}
                className="flex-1 py-3 bg-slate-100 font-bold rounded-2xl text-mk-text"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleSaveCharge}
                className="flex-1 py-3 bg-amber-600 text-white font-bold rounded-2xl shadow"
              >
                उधार दर्ज करें
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Repayment Modal */}
      {isAddRepaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4">
            <h3 className="font-extrabold text-lg text-mk-text">{t.repaymentReceivedBtn}</h3>
            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">{t.repayAmount} *</label>
              <input
                type="number"
                step="1"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[48px] px-3 font-extrabold text-xl rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">{t.repayMethod}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRepayMethod('cash')}
                  className={`py-2.5 rounded-2xl font-bold text-sm ${
                    repayMethod === 'cash' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  नकद (Cash)
                </button>
                <button
                  type="button"
                  onClick={() => setRepayMethod('upi')}
                  className={`py-2.5 rounded-2xl font-bold text-sm ${
                    repayMethod === 'upi' ? 'bg-mk-purple text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  UPI (ऑनलाइन)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">टिप्पणी / विवरण</label>
              <input
                type="text"
                value={repayNotes}
                onChange={(e) => setRepayNotes(e.target.value)}
                placeholder="उदा. आधा भुगतान किया"
                className="w-full min-h-[46px] px-3 font-bold text-sm rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddRepaymentOpen(false)}
                className="flex-1 py-3 bg-slate-100 font-bold rounded-2xl text-mk-text"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleSaveRepayment}
                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-2xl shadow"
              >
                भुगतान दर्ज करें
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reversal / Void Modal */}
      {isReversalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4">
            <h3 className="font-extrabold text-lg text-red-600">गलती सुधारें (रद्द करें)</h3>
            <p className="text-xs text-mk-muted">
              यह प्रविष्टि खाते में रद्द हो जाएगी तथा पिछला सही हिसाब बहाल हो जाएगा।
            </p>
            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">रद्द करने का कारण *</label>
              <input
                type="text"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="उदा. गलती से गलत राशि दर्ज हुई"
                className="w-full min-h-[46px] px-3 font-bold text-sm rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReversalOpen(false)}
                className="flex-1 py-3 bg-slate-100 font-bold rounded-2xl"
              >
                कैंसल
              </button>
              <button
                type="button"
                onClick={handleConfirmReversal}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-2xl shadow"
              >
                रद्द की पुष्टि करें
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
