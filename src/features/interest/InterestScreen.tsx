import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  Printer,
  Share2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Language } from '../../i18n';
import { translations } from '../../i18n';
import {
  calculateSingleInterest,
  calculateGrandInterest,
  getTodayKolkataDate,
  type GrandInterestResult,
} from '../../domain/interest';
import { DateInput } from '../../components/DateInput';
import { formatINR } from '../../domain/money';

interface InterestScreenProps {
  language: Language;
}

interface LoanEntryForm {
  id: string;
  label: string;
  principal: string;
  monthlyRate: string;
  startDate: string;
  endDate: string;
  isCustomEndDate: boolean;
}

export const InterestScreen: React.FC<InterestScreenProps> = ({ language }) => {
  const navigate = useNavigate();
  const t = translations[language];
  const isHi = language === 'hi';

  const todayStr = getTodayKolkataDate();

  const [entries, setEntries] = useState<LoanEntryForm[]>([
    {
      id: 'entry-1',
      label: 'लोन 1 (Loan 1)',
      principal: '10000',
      monthlyRate: '2',
      startDate: '01-01-2024',
      endDate: todayStr,
      isCustomEndDate: false,
    },
  ]);

  const [result, setResult] = useState<GrandInterestResult | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({
    'entry-1': true,
  });

  const handleAddEntry = () => {
    const nextId = `entry-${Date.now()}`;
    setEntries((prev) => [
      ...prev,
      {
        id: nextId,
        label: `लोन ${prev.length + 1}`,
        principal: '',
        monthlyRate: '2',
        startDate: '',
        endDate: todayStr,
        isCustomEndDate: false,
      },
    ]);
    setExpandedEntries((prev) => ({ ...prev, [nextId]: true }));
    setResult(null); // Invalidate previous calculation
  };

  const handleRemoveEntry = (id: string) => {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setResult(null);
  };

  const handleUpdateEntry = (id: string, field: keyof LoanEntryForm, value: any) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
    setResult(null);
  };

  const handleCalculate = () => {
    setCalculationError(null);

    const formattedPayload = entries.map((e) => ({
      id: e.id,
      label: e.label,
      principal: e.principal,
      monthlyRate: e.monthlyRate,
      startDate: e.startDate,
      endDate: e.isCustomEndDate ? e.endDate : todayStr,
    }));

    const res = calculateGrandInterest(formattedPayload);
    if (!res.success) {
      setCalculationError(res.error);
      setResult(null);
      return;
    }

    setResult(res.result);
  };

  const toggleExpand = (id: string) => {
    setExpandedEntries((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 space-y-5 pb-24">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-11 h-11 rounded-2xl bg-white border border-mk-line flex items-center justify-center text-mk-text hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
          aria-label="Back to home"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-mk-text leading-tight">
            {t.byajHeading}
          </h2>
          <p className="text-xs text-mk-muted mt-0.5">
            {isHi ? 'मासिक दर • वार्षिक चक्रवृद्धित' : 'Monthly rate • Annual compounding'}
          </p>
        </div>
      </div>

      {/* Methodology Rule Box */}
      <div className="p-3.5 bg-mk-soft/50 rounded-2xl border border-purple-200/60 text-xs text-mk-purple leading-relaxed">
        <strong>{isHi ? 'दुकान का ब्याज नियम:' : 'Kirana Rule:'}</strong>{' '}
        {t.byajMethodTag}
      </div>

      {/* Entries Form */}
      <div className="space-y-4">
        {entries.map((entry, index) => {
          const isExpanded = expandedEntries[entry.id] ?? true;

          return (
            <div
              key={entry.id}
              className="p-4 bg-white rounded-3xl border border-mk-line shadow-sm space-y-4 transition-all"
            >
              {/* Entry Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-extrabold text-base text-mk-text flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-lg bg-mk-soft text-mk-purple text-xs flex items-center justify-center">
                    {index + 1}
                  </span>
                  {entry.label || `प्रविष्टि ${index + 1}`}
                </span>

                <div className="flex items-center gap-1">
                  {entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEntry(entry.id)}
                      className="w-9 h-9 rounded-xl text-red-500 hover:bg-red-50 flex items-center justify-center"
                      title="हटाएँ (Remove)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpand(entry.id)}
                    className="w-9 h-9 rounded-xl text-mk-muted hover:bg-slate-100 flex items-center justify-center"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Form Fields */}
              {isExpanded && (
                <div className="space-y-3.5">
                  {/* Principal & Monthly Rate */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-mk-text mb-1">
                        {isHi ? 'मूलधन (₹)' : 'Principal (₹)'}
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={entry.principal}
                        onChange={(e) =>
                          handleUpdateEntry(entry.id, 'principal', e.target.value)
                        }
                        placeholder="10000"
                        className="w-full min-h-touch px-3 text-lg font-bold rounded-2xl bg-slate-50 border border-mk-line text-mk-text focus:outline-none focus:border-mk-purple focus:ring-2 focus:ring-mk-soft"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-mk-text mb-1">
                        {isHi ? 'मासिक दर (%)' : 'Monthly Rate (%)'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={entry.monthlyRate}
                          onChange={(e) =>
                            handleUpdateEntry(entry.id, 'monthlyRate', e.target.value)
                          }
                          placeholder="2"
                          className="w-full min-h-touch px-3 text-lg font-bold rounded-2xl bg-slate-50 border border-mk-line text-mk-text focus:outline-none focus:border-mk-purple focus:ring-2 focus:ring-mk-soft"
                        />
                        <span className="absolute right-3 top-4 text-xs font-extrabold text-mk-muted">
                          % {isHi ? 'माह' : '/mo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Start Date */}
                  <DateInput
                    id={`start-date-${entry.id}`}
                    label={t.startDate}
                    value={entry.startDate}
                    onChange={(val) => handleUpdateEntry(entry.id, 'startDate', val)}
                    placeholder="DD-MM-YYYY"
                  />

                  {/* End Date with Today / Custom Toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-mk-text">
                        {t.endDate}
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateEntry(
                            entry.id,
                            'isCustomEndDate',
                            !entry.isCustomEndDate
                          )
                        }
                        className="text-xs font-bold text-mk-purple hover:underline"
                      >
                        {entry.isCustomEndDate ? t.todayBtn : t.customEndBtn}
                      </button>
                    </div>

                    {entry.isCustomEndDate ? (
                      <DateInput
                        id={`end-date-${entry.id}`}
                        value={entry.endDate}
                        onChange={(val) => handleUpdateEntry(entry.id, 'endDate', val)}
                        placeholder="DD-MM-YYYY"
                      />
                    ) : (
                      <div className="min-h-touch px-4 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-mk-text font-bold text-lg flex items-center justify-between">
                        <span>{todayStr}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {isHi ? 'आज' : 'Today'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Entry Button */}
        <button
          type="button"
          onClick={handleAddEntry}
          className="w-full min-h-touch border-2 border-dashed border-mk-purple/30 hover:border-mk-purple bg-mk-soft/20 text-mk-purple font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
        >
          <Plus className="w-5 h-5" />
          <span>{t.addLoanEntry}</span>
        </button>
      </div>

      {/* Calculate Button */}
      <button
        type="button"
        onClick={handleCalculate}
        className="w-full min-h-touch bg-mk-purple hover:bg-mk-purple-dark text-white text-lg font-bold rounded-2xl shadow-lg shadow-mk-purple/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
      >
        <Calculator className="w-6 h-6 stroke-[2.2]" />
        <span>{t.calculateByajBtn}</span>
      </button>

      {/* Error Message */}
      {calculationError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-bold">
          {calculationError}
        </div>
      )}

      {/* Output Results */}
      {result && (
        <div className="space-y-4 pt-2 animate-fade-in">
          {/* Grand Total Banner */}
          <div className="p-5 bg-gradient-to-br from-mk-purple to-[#3F1270] text-white rounded-3xl shadow-xl space-y-3">
            <span className="text-xs font-bold text-purple-200 uppercase tracking-wider block">
              {t.combinedGrandTotal}
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold tracking-tight">
                {formatINR(result.grandTotal)}
              </span>
              <span className="text-xs text-purple-200">
                {result.entries.length} {isHi ? 'प्रविष्टियाँ' : 'Entries'}
              </span>
            </div>

            <div className="pt-3 border-t border-white/15 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-purple-200 block">{isHi ? 'कुल मूलधन:' : 'Total Principal:'}</span>
                <span className="text-base font-bold">{formatINR(result.combinedPrincipal)}</span>
              </div>
              <div className="text-right">
                <span className="text-purple-200 block">{isHi ? 'कुल ब्याज:' : 'Total Interest:'}</span>
                <span className="text-base font-bold text-amber-300">
                  +{formatINR(result.combinedInterest)}
                </span>
              </div>
            </div>
          </div>

          {/* Individual Entry Cards */}
          {result.entries.map((entry, idx) => (
            <div
              key={entry.entryId}
              className="p-4 bg-white rounded-3xl border border-mk-line shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-extrabold text-base text-mk-text">
                  {entry.label || `प्रविष्टि ${idx + 1}`}
                </h4>
                <span className="px-2.5 py-1 bg-mk-soft text-mk-purple text-xs font-bold rounded-lg">
                  {isHi ? entry.duration.formattedHi : entry.duration.formattedEn}
                </span>
              </div>

              {/* Period Breakdown Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-mk-muted uppercase tracking-wider block">
                  {t.periodBreakdown}
                </span>

                <div className="space-y-1.5">
                  {entry.periods.map((p) => (
                    <div
                      key={p.periodIndex}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-mk-text block">
                          {isHi ? p.labelHi : p.labelEn}
                        </span>
                        <span className="text-[11px] text-mk-muted">
                          {p.fromDate} से {p.toDate}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-amber-800 block">
                          +{formatINR(p.interestAmount)}
                        </span>
                        <span className="text-[11px] text-mk-muted">
                          {isHi ? 'योग:' : 'Bal:'} {formatINR(p.closingPrincipal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Entry Total & Explanation */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-mk-muted block">{t.finalPayableAmount}</span>
                  <span className="text-xl font-black text-mk-text">
                    {formatINR(entry.finalAmount)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-mk-muted block">{t.totalInterestEarned}</span>
                  <span className="text-base font-bold text-amber-700">
                    +{formatINR(entry.totalInterest)}
                  </span>
                </div>
              </div>

              {/* Bilingual Explanation Box */}
              <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/60 text-xs text-amber-900 leading-relaxed">
                {isHi ? entry.explanationHi : entry.explanationEn}
              </div>
            </div>
          ))}

          {/* Action Buttons: Print / Share */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 min-h-touch bg-white border border-mk-line hover:bg-slate-50 text-mk-text font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
            >
              <Printer className="w-5 h-5 text-mk-muted" />
              <span>{t.printOrPdf}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

