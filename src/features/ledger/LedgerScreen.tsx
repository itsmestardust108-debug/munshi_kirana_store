import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  UserPlus,
  BookOpenCheck,
  AlertCircle,
  ChevronRight,
  PlusCircle,
  CheckCircle,
  Share2,
} from 'lucide-react';
import type { Language } from '../../i18n';
import { translations } from '../../i18n';
import { db, seedDemoDataIfEmpty } from '../../data/db';
import type { Customer, CreditCharge, Repayment, LedgerReversal, CustomerLedgerSummary } from '../../domain/ledger';
import { buildCustomerLedgerSummary } from '../../domain/ledger';
import { formatINR } from '../../domain/money';
import { buildLedgerReminderWhatsAppLink } from '../../integrations/whatsapp';

interface LedgerScreenProps {
  language: Language;
}

export const LedgerScreen: React.FC<LedgerScreenProps> = ({ language }) => {
  const navigate = useNavigate();
  const t = translations[language];
  const isHi = language === 'hi';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summaries, setSummaries] = useState<CustomerLedgerSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Add Customer Modal
  const [isNewCustModalOpen, setIsNewCustModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustNotes, setNewCustNotes] = useState('');

  const loadData = async () => {
    await seedDemoDataIfEmpty();
    const custs = await db.customers.filter((c) => c.isActive).toArray();
    const charges = await db.credit_charges.toArray();
    const repayments = await db.repayments.toArray();
    const reversals = await db.ledger_reversals.toArray();

    const summs = custs.map((c) =>
      buildCustomerLedgerSummary(c, charges, repayments, reversals)
    );

    // Sort: highest outstanding first
    summs.sort((a, b) => b.outstandingBalance.minus(a.outstandingBalance).toNumber());

    setCustomers(custs);
    setSummaries(summs);
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalOutstandingAll = summaries.reduce(
    (acc, curr) => acc + curr.outstandingBalance.toNumber(),
    0
  );

  const filteredSummaries = summaries.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.customerName.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(q))
    );
  });

  const handleCreateCustomer = async () => {
    if (!newCustName.trim()) return;

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      shopId: 'demo-munsi-kirana-001',
      name: newCustName.trim(),
      phone: newCustPhone.trim() || undefined,
      notes: newCustNotes.trim() || undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.customers.add(newCust);
    setIsNewCustModalOpen(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustNotes('');
    await loadData();
  };

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-11 h-11 rounded-2xl bg-white border border-mk-line flex items-center justify-center text-mk-text hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-mk-text leading-tight">
              {t.khataHeading}
            </h2>
            <p className="text-xs text-mk-muted mt-0.5">
              {customers.length} {isHi ? 'ग्राहक खाते' : 'customer accounts'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsNewCustModalOpen(true)}
          className="px-3.5 py-2.5 bg-mk-purple hover:bg-mk-purple-dark text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-md shadow-mk-purple/20 transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isHi ? '+ नया खाता' : '+ Account'}</span>
        </button>
      </div>

      {/* Outstanding Total Banner */}
      <div className="p-5 bg-gradient-to-br from-amber-600 to-amber-700 text-white rounded-3xl shadow-lg space-y-2">
        <span className="text-xs font-bold text-amber-200 uppercase tracking-wider block">
          {t.totalOutstandingAll}
        </span>
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-black tracking-tight">
            {formatINR(totalOutstandingAll)}
          </span>
          <span className="text-xs font-semibold text-amber-100">
            {summaries.filter((s) => s.outstandingBalance.greaterThan(0)).length} {isHi ? 'खातों में बाकी' : 'accounts due'}
          </span>
        </div>
      </div>

      {/* Customer Search Bar */}
      <div className="bg-white p-2.5 rounded-2xl border border-mk-line shadow-sm flex items-center gap-2">
        <Search className="w-5 h-5 text-mk-muted flex-shrink-0 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchCustomerPlaceholder}
          className="w-full bg-transparent font-semibold text-sm text-mk-text focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2"
          >
            ✕
          </button>
        )}
      </div>

      {/* Customers List */}
      <div className="space-y-2.5">
        {filteredSummaries.map((summary) => (
          <div
            key={summary.customerId}
            onClick={() => navigate(`/ledger/${summary.customerId}`)}
            className="p-4 rounded-3xl bg-white border border-mk-line shadow-sm hover:bg-slate-50 cursor-pointer active:scale-[0.99] transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-base text-mk-text">
                  {summary.customerName}
                </h4>
                {summary.phone && (
                  <p className="text-xs text-mk-muted font-medium mt-0.5">
                    {summary.phone}
                  </p>
                )}
              </div>

              <div className="text-right">
                <span className="text-xs text-mk-muted font-bold block">
                  {t.balanceDueLabel}
                </span>
                <span
                  className={`text-xl font-black ${
                    summary.outstandingBalance.greaterThan(0)
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {formatINR(summary.outstandingBalance)}
                </span>
              </div>
            </div>

            {/* Overdue Warning */}
            {summary.isOverdue && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-xl w-fit">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{t.overdueWarning}</span>
              </div>
            )}

            {/* Quick Actions Footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-mk-muted">
              <span>
                {summary.lastActivityDate
                  ? `${isHi ? 'अंतिम लेन-देन:' : 'Last:'} ${summary.lastActivityDate}`
                  : isHi ? 'नया खाता' : 'New account'}
              </span>

              <div className="flex items-center gap-2">
                {summary.outstandingBalance.greaterThan(0) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = buildLedgerReminderWhatsAppLink(
                        summary.customerName,
                        summary.phone,
                        summary.outstandingBalance.toNumber(),
                        'मुंशी किराना स्टोर'
                      );
                      if (link.url) window.open(link.url, '_blank');
                    }}
                    className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1"
                    title={t.sendReminderWhatsApp}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold">तगादा</span>
                  </button>
                )}
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Add Customer Modal */}
      {isNewCustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4">
            <h3 className="font-extrabold text-lg text-mk-text">
              {isHi ? 'नया ग्राहक खाता खोलें' : 'Create Customer Account'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">
                {isHi ? 'ग्राहक का नाम' : 'Customer Name'} *
              </label>
              <input
                type="text"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="उदा. रमेश कुमार"
                className="w-full min-h-[46px] px-3 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">
                {isHi ? 'मोबाइल नंबर (WhatsApp तगादा के लिए)' : 'Mobile Phone'}
              </label>
              <input
                type="tel"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full min-h-[46px] px-3 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">
                {isHi ? 'पता / पहचान विवरण (वैकल्पिक)' : 'Address / Notes'}
              </label>
              <input
                type="text"
                value={newCustNotes}
                onChange={(e) => setNewCustNotes(e.target.value)}
                placeholder="उदा. वार्ड 4, मंदिर के पास"
                className="w-full min-h-[46px] px-3 font-medium text-sm rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewCustModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 font-bold rounded-2xl text-mk-text"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
                className="flex-1 py-3 bg-mk-purple text-white font-bold rounded-2xl shadow"
              >
                खाता बनाएँ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
