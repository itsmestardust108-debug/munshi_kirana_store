import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Download,
  Upload,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  HardDrive,
  FileCheck,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { Language } from '../../i18n';
import { translations } from '../../i18n';
import { db, seedDemoDataIfEmpty } from '../../data/db';
import { formatINR } from '../../domain/money';
import { getTodayKolkataDate } from '../../domain/interest';
import { buildCustomerLedgerSummary } from '../../domain/ledger';
import {
  createEncryptedBackup,
  verifyAndPreviewBackup,
  executeRestore,
  type RestorePreview,
} from '../../integrations/backup';

interface ReportsScreenProps {
  language: Language;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ language }) => {
  const navigate = useNavigate();
  const t = translations[language];
  const isHi = language === 'hi';

  const [todayDate, setTodayDate] = useState(getTodayKolkataDate());

  // Metrics
  const [netSales, setNetSales] = useState(0);
  const [cashCollected, setCashCollected] = useState(0);
  const [upiCollected, setUpiCollected] = useState(0);
  const [newCreditIssued, setNewCreditIssued] = useState(0);
  const [creditRecovered, setCreditRecovered] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);

  // Backup State
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Restore State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileText, setSelectedFileText] = useState<string | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const loadMetrics = async () => {
    await seedDemoDataIfEmpty();

    // 1. Fetch today's completed bills
    const bills = await db.bills
      .where('businessDate')
      .equals(todayDate)
      .filter((b) => b.status === 'completed')
      .toArray();

    let sales = 0;
    let billCash = 0;
    let billUpi = 0;
    let billCredit = 0;

    for (const b of bills) {
      sales += b.grandTotal;
      billCash += b.settlement.cashReceived || 0;
      billUpi += b.settlement.upiReceived || 0;
      billCredit += b.settlement.creditDue || 0;
    }

    // 2. Fetch all ledger entries, reversals, and customers
    const allCharges = await db.credit_charges.toArray();
    const allRepayments = await db.repayments.toArray();
    const allReversals = await db.ledger_reversals.toArray();
    const allCustomers = await db.customers.toArray();

    const reversedRepaymentIds = new Set(
      allReversals.filter((r) => r.targetType === 'repayment').map((r) => r.targetId)
    );

    // Repayments collected on selected date (excluding reversed)
    const todayRepayments = allRepayments.filter(
      (r) => r.paymentDate === todayDate && !r.isReversed && !reversedRepaymentIds.has(r.id)
    );

    let repayCash = 0;
    let repayUpi = 0;

    for (const r of todayRepayments) {
      if (r.method === 'cash') repayCash += Number(r.amount);
      if (r.method === 'upi') repayUpi += Number(r.amount);
    }

    // 3. Compute total outstanding per-customer via authoritative summary (incorporating reversals)
    let outstanding = 0;
    for (const cust of allCustomers) {
      const s = buildCustomerLedgerSummary(cust, allCharges, allRepayments, allReversals);
      outstanding += s.outstandingBalance.toNumber();
    }

    setNetSales(sales);
    setCashCollected(billCash + repayCash);
    setUpiCollected(billUpi + repayUpi);
    setNewCreditIssued(billCredit);
    setCreditRecovered(repayCash + repayUpi);
    setTotalOutstanding(outstanding);
  };

  useEffect(() => {
    loadMetrics();
  }, [todayDate]);

  // Export Backup Handler
  const handleExportBackup = async () => {
    if (!exportPassphrase || exportPassphrase.length < 4) {
      alert('कृपया कम से कम 4 अक्षरों का सुरक्षित पासवर्ड दर्ज करें');
      return;
    }

    setIsExporting(true);
    setExportSuccess(false);

    try {
      const encryptedJson = await createEncryptedBackup(exportPassphrase);
      const blob = new Blob([encryptedJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MunsiKirana_Backup_${todayDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setExportPassphrase('');
    } catch (err: any) {
      alert(err.message || 'बैकअप बनाने में त्रुटि');
    } finally {
      setIsExporting(false);
    }
  };

  // Restore File Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      setSelectedFileText(evt.target?.result as string);
      setRestorePreview(null);
      setRestoreError(null);
    };
    reader.readAsText(file);
  };

  const handlePreviewRestore = async () => {
    if (!selectedFileText || !restorePassphrase) {
      setRestoreError('कृपया बैकअप फाइल और पासवर्ड दोनों दर्ज करें');
      return;
    }

    setRestoreError(null);
    try {
      const preview = await verifyAndPreviewBackup(selectedFileText, restorePassphrase);
      setRestorePreview(preview);
    } catch (err: any) {
      setRestoreError(err.message || 'डिक्रिप्शन विफल');
    }
  };

  const handleExecuteRestore = async () => {
    if (!restorePreview) return;
    setIsRestoring(true);

    try {
      await executeRestore(restorePreview.payload);
      setRestoreSuccess(true);
      setRestorePreview(null);
      setSelectedFileText(null);
      setRestorePassphrase('');
      await loadMetrics();
    } catch (err: any) {
      alert(err.message || 'रीस्टोर में त्रुटि');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="p-4 space-y-5 pb-28">
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
              {t.reportsHeading}
            </h2>
            <p className="text-xs text-mk-muted mt-0.5">{todayDate}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="px-3 py-2.5 rounded-2xl bg-mk-soft text-mk-purple hover:bg-mk-soft/80 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
            title="दुकान सेटिंग व फोन लिंक"
          >
            <Smartphone className="w-4 h-4" />
            <span>{isHi ? 'सेटिंग व फोन' : 'Settings'}</span>
          </button>
          <button
            type="button"
            onClick={() => loadMetrics()}
            className="w-11 h-11 rounded-2xl bg-white border border-mk-line flex items-center justify-center text-mk-muted hover:text-mk-purple hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
            title="रिफ्रेश करें"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Daily Overview Metric Cards Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-mk-muted uppercase tracking-wider px-1">
          {isHi ? 'दुकान का आज का हिसाब' : "Today's Ledger Overview"}
        </h3>

        {/* Net Sales Banner */}
        <div className="p-5 bg-mk-purple text-white rounded-3xl shadow-lg space-y-1">
          <span className="text-xs font-bold text-purple-200 uppercase tracking-wider block">
            {t.todaySales}
          </span>
          <span className="text-3xl font-black tracking-tight">{formatINR(netSales)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Cash Collected */}
          <div className="p-4 rounded-3xl bg-white border border-mk-line shadow-sm space-y-1">
            <span className="text-xs font-bold text-mk-muted block">{t.todayCashCollected}</span>
            <span className="text-xl font-black text-emerald-700">{formatINR(cashCollected)}</span>
          </div>

          {/* UPI Collected */}
          <div className="p-4 rounded-3xl bg-white border border-mk-line shadow-sm space-y-1">
            <span className="text-xs font-bold text-mk-muted block">{t.todayUpiCollected}</span>
            <span className="text-xl font-black text-mk-purple">{formatINR(upiCollected)}</span>
          </div>

          {/* New Credit Issued */}
          <div className="p-4 rounded-3xl bg-white border border-mk-line shadow-sm space-y-1">
            <span className="text-xs font-bold text-mk-muted block">{t.todayNewCredit}</span>
            <span className="text-xl font-black text-amber-700">{formatINR(newCreditIssued)}</span>
          </div>

          {/* Old Credit Recovered */}
          <div className="p-4 rounded-3xl bg-white border border-mk-line shadow-sm space-y-1">
            <span className="text-xs font-bold text-mk-muted block">{t.todayCreditRecovered}</span>
            <span className="text-xl font-black text-emerald-600">{formatINR(creditRecovered)}</span>
          </div>
        </div>

        {/* Total Outstanding Khata Balance */}
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
              {isHi ? 'कुल बाकी उधारी (अभी तक)' : 'Total Outstanding (Current)'}
            </span>
            <span className="text-2xl font-black text-amber-900">{formatINR(totalOutstanding)}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/ledger')}
            className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl shadow active:scale-95 transition-all"
          >
            {isHi ? 'खाता खोलें →' : 'View Khata →'}
          </button>
        </div>
      </div>

      {/* Encrypted Backup & Restore Section */}
      <div className="bg-white rounded-3xl border border-mk-line shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 text-mk-purple">
          <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
          <h3 className="text-lg font-black text-mk-text">{t.backupAndRestore}</h3>
        </div>
        <p className="text-xs text-mk-muted leading-relaxed">
          {isHi
            ? 'आपका डेटा सुरक्षित एन्क्रिप्टेड फाइल में डाउनलोड करें। फोन बदलने पर इसे आसानी से रीस्टोर किया जा सकता है।'
            : 'Download your shop data securely encrypted. Restore anytime on another phone.'}
        </p>

        {/* Export Backup Card */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-mk-line space-y-3">
          <span className="text-xs font-bold text-mk-text block">
            {isHi ? '१. सुरक्षित बैकअप फाइल डाउनलोड करें' : '1. Export Encrypted Backup'}
          </span>
          <div>
            <label className="block text-[11px] font-bold text-mk-muted mb-1">
              {isHi ? 'बैकअप पासवर्ड तय करें (कम से कम 4 अक्षर)' : 'Set Backup Password'}
            </label>
            <div className="relative">
              <input
                type="password"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
                placeholder="उदा. 1234 या गुप्त कोड"
                className="w-full min-h-[46px] px-3 font-bold text-sm rounded-xl bg-white border border-mk-line"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            </div>
          </div>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportBackup}
            className="w-full py-3 bg-mk-purple hover:bg-mk-purple-dark text-white font-bold text-sm rounded-xl shadow flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'बैकअप बन रहा है...' : t.exportBackupBtn}</span>
          </button>

          {exportSuccess && (
            <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              <span>बैकअप फाइल डाउनलोड हो गई है!</span>
            </p>
          )}
        </div>

        {/* Import / Restore Card */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-mk-line space-y-3">
          <span className="text-xs font-bold text-mk-text block">
            {isHi ? '२. बैकअप फाइल से डेटा रीस्टोर करें' : '2. Restore Shop from File'}
          </span>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileSelect}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 bg-white hover:bg-slate-100 border border-mk-line text-mk-text font-bold text-sm rounded-xl flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4 text-mk-muted" />
            <span>
              {selectedFileText
                ? isHi
                  ? 'फाइल चुनी गई ✓ (बदलने के लिए टैप करें)'
                  : 'File Selected ✓'
                : isHi
                ? 'बैकअप फाइल चुनें (.json)'
                : 'Select Backup File'}
            </span>
          </button>

          {selectedFileText && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-mk-muted mb-1">
                  {isHi ? 'बैकअप पासवर्ड दर्ज करें' : 'Enter Backup Password'}
                </label>
                <input
                  type="password"
                  value={restorePassphrase}
                  onChange={(e) => setRestorePassphrase(e.target.value)}
                  placeholder="पासवर्ड"
                  className="w-full min-h-[46px] px-3 font-bold text-sm rounded-xl bg-white border border-mk-line"
                />
              </div>

              <button
                type="button"
                onClick={handlePreviewRestore}
                className="w-full py-2.5 bg-slate-800 text-white font-bold text-xs rounded-xl shadow"
              >
                {isHi ? 'फाइल चेक करें (Verify)' : 'Verify File'}
              </button>
            </div>
          )}

          {restoreError && (
            <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>{restoreError}</span>
            </p>
          )}

          {/* Dry Run Preview Confirmation */}
          {restorePreview && (
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-2.5 text-xs animate-scale-up">
              <h4 className="font-extrabold text-sm text-mk-purple">
                रीस्टोर पूर्व-पुष्टि (Preview):
              </h4>
              <p>दुकान: <strong>{restorePreview.shopName}</strong></p>
              <ul className="space-y-1 text-slate-700">
                <li>• सामान सूची: <strong>{restorePreview.counts.inventory}</strong> आइटम</li>
                <li>• ग्राहक खाते: <strong>{restorePreview.counts.customers}</strong> ग्राहक</li>
                <li>• कुल बिल: <strong>{restorePreview.counts.bills}</strong> बिल</li>
                <li>• उधारी व वसूली: <strong>{restorePreview.counts.charges + restorePreview.counts.repayments}</strong> प्रविष्टियाँ</li>
              </ul>

              <button
                type="button"
                disabled={isRestoring}
                onClick={handleExecuteRestore}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow mt-2"
              >
                {isRestoring ? 'रीस्टोर हो रहा है...' : 'हाँ, डेटा रीस्टोर करें'}
              </button>
            </div>
          )}

          {restoreSuccess && (
            <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              <span>दुकान का डेटा सफलतापूर्वक रीस्टोर हो गया!</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

