import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Smartphone,
  RefreshCw,
  ShieldCheck,
  Download,
  Upload,
  Lock,
  Store,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  Cloud,
  QrCode,
} from 'lucide-react';
import type { Language } from '../../i18n';
import { translations } from '../../i18n';
import { db, DEMO_SHOP_ID, type ShopRecord } from '../../data/db';
import { isCloudConfigured } from '../../integrations/supabaseClient';
import { processOutbox, pullRemoteChanges } from '../../integrations/syncEngine';
import {
  createEncryptedBackup,
  verifyAndPreviewBackup,
  executeRestore,
  type RestorePreview,
} from '../../integrations/backup';

interface SettingsScreenProps {
  language: Language;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ language }) => {
  const navigate = useNavigate();
  const t = translations[language];
  const isHi = language === 'hi';

  const [shop, setShop] = useState<ShopRecord | null>(null);
  const [copiedShopId, setCopiedShopId] = useState(false);

  // Sync state
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Two-Phone Link Form
  const [linkShopIdInput, setLinkShopIdInput] = useState('');
  const [isLinking, setIsLinking] = useState(false);

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

  const loadData = async () => {
    const s = await db.shops.toCollection().first();
    setShop(s || null);
    const count = await db.sync_outbox.where('status').equals('pending').count();
    setPendingOutboxCount(count);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyShopId = () => {
    if (!shop?.id) return;
    navigator.clipboard.writeText(shop.id);
    setCopiedShopId(true);
    setTimeout(() => setCopiedShopId(false), 2000);
  };

  const handleToggleConfirmedTagline = async (confirmed: boolean) => {
    if (!shop?.id) return;
    await db.shops.update(shop.id, {
      isOwnerConfirmedTagline: confirmed,
      updatedAt: new Date().toISOString(),
    });
    setShop({
      ...shop,
      isOwnerConfirmedTagline: confirmed,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const { processed } = await processOutbox();
      const { updatedCount } = await pullRemoteChanges(shop?.id || DEMO_SHOP_ID);
      setSyncMessage(
        isHi
          ? `सिंक पूर्ण! ${processed} रिकॉर्ड अपलोड, ${updatedCount} अपडेट प्राप्त हुए`
          : `Sync complete! ${processed} uploaded, ${updatedCount} pulled`
      );
      await loadData();
    } catch (err: any) {
      setSyncMessage(err?.message || 'Sync error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLinkExistingShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkShopIdInput.trim()) return;

    setIsLinking(true);
    try {
      const targetShopId = linkShopIdInput.trim();
      const { updatedCount } = await pullRemoteChanges(targetShopId);
      if (shop) {
        await db.shops.update(shop.id, { id: targetShopId });
      }
      alert(
        isHi
          ? `सफलतापूर्वक लिंक हुआ! ${updatedCount} सामान व खाते प्राप्त हुए`
          : `Linked successfully! Pulled ${updatedCount} records`
      );
      setLinkShopIdInput('');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Linking failed');
    } finally {
      setIsLinking(false);
    }
  };

  const handleExportBackup = async () => {
    if (!exportPassphrase || exportPassphrase.length < 4) {
      alert(isHi ? 'कम से कम 4 अक्षरों का पासवर्ड दर्ज करें' : 'Enter at least 4 characters');
      return;
    }

    setIsExporting(true);
    try {
      const encryptedJson = await createEncryptedBackup(exportPassphrase);
      const blob = new Blob([encryptedJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MunsiKirana_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setExportPassphrase('');
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || 'Export error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError(null);
    setRestorePreview(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedFileText(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handlePreviewRestore = async () => {
    if (!selectedFileText) {
      setRestoreError(isHi ? 'कृपया बैकअप फाइल चुनें' : 'Please select backup file');
      return;
    }
    if (!restorePassphrase) {
      setRestoreError(isHi ? 'पासवर्ड दर्ज करें' : 'Enter password');
      return;
    }

    setRestoreError(null);
    try {
      const preview = await verifyAndPreviewBackup(selectedFileText, restorePassphrase);
      setRestorePreview(preview);
    } catch (err: any) {
      setRestoreError(err.message || 'Verification error');
    }
  };

  const handleExecuteRestore = async () => {
    if (!restorePreview) return;
    const confirm = window.confirm(
      isHi
        ? 'क्या आप निश्चित हैं? मौजूदा डेटा इस बैकअप से बदल दिया जाएगा।'
        : 'Are you sure? Existing records will be replaced with this backup.'
    );
    if (!confirm) return;

    setIsRestoring(true);
    try {
      await executeRestore(restorePreview.payload);
      setRestoreSuccess(true);
      setRestorePreview(null);
      setSelectedFileText(null);
      setRestorePassphrase('');
      await loadData();
      alert(isHi ? 'डेटा सफलतापूर्वक रीस्टोर हुआ!' : 'Data restored successfully!');
    } catch (err: any) {
      alert(err.message || 'Restore error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="p-4 space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-mk-purple font-bold text-sm hover:underline"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{isHi ? 'वापस' : 'Back'}</span>
        </button>
        <h1 className="font-extrabold text-lg text-mk-text">
          {isHi ? 'दुकान सेटिंग व फोन लिंक' : 'Shop Settings & Sync'}
        </h1>
        <div className="w-8" />
      </div>

      {/* Shop & Dadaji Tribute Card */}
      <div className="bg-gradient-to-r from-purple-900 via-mk-purple to-purple-950 text-white rounded-3xl p-4 shadow-md space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-amber-300 overflow-hidden flex-shrink-0 shadow">
            <img
              src="/dadaji-photo.jpg"
              alt="श्री मुंशी सेठ जी"
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/favicon.svg';
              }}
            />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-purple-950 px-2 py-0.5 rounded-full">
              {isHi ? 'दुकान पहचान' : 'Shop Identity'}
            </span>
            <h2 className="text-lg font-black text-amber-100 mt-0.5">
              {shop?.name || 'मुंशी किराना स्टोर'}
            </h2>
            <p className="text-xs text-purple-200">
              {isHi ? 'आशीर्वाद: श्री मुंशी सेठ जी' : 'Blessings: Shri Munshi Seth Ji'}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-purple-800/60 flex items-center justify-between text-xs">
          <span className="text-purple-300">दुकान कोड (Shop ID):</span>
          <button
            type="button"
            onClick={handleCopyShopId}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-xl font-mono text-[11px] text-amber-200 transition-colors"
          >
            <span>{shop?.id?.slice(0, 16)}...</span>
            {copiedShopId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Tagline & Receipt Branding Configuration Card */}
      <div className="bg-white p-4 rounded-3xl border border-mk-line shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-mk-purple" />
          <h3 className="font-bold text-base text-mk-text">
            {isHi ? 'रसीद टैगलाइन व ऐतिहासिक दावा' : 'Receipt Tagline & Claim'}
          </h3>
        </div>

        <p className="text-xs text-mk-muted leading-relaxed">
          {isHi
            ? 'पक्की रसीद व WhatsApp शेयरिंग पर दिखने वाली टैगलाइन चुनें:'
            : 'Select the tagline that appears on digital receipts and shared images:'}
        </p>

        <div className="space-y-2">
          {/* Option 1: Unconfirmed / Verified Default */}
          <label
            onClick={() => handleToggleConfirmedTagline(false)}
            className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
              !shop?.isOwnerConfirmedTagline
                ? 'bg-purple-50/70 border-mk-purple text-mk-purple'
                : 'bg-slate-50 border-mk-line text-slate-700'
            }`}
          >
            <input
              type="radio"
              name="taglineChoice"
              checked={!shop?.isOwnerConfirmedTagline}
              onChange={() => handleToggleConfirmedTagline(false)}
              className="mt-1 accent-mk-purple"
            />
            <div className="text-xs">
              <span className="font-bold text-sm block text-mk-text">
                "आपकी अपनी भरोसेमंद किराना दुकान"
              </span>
              <span className="text-slate-500">
                (मानक पारिवारिक पहचान — Your trusted family kirana store)
              </span>
            </div>
          </label>

          {/* Option 2: Owner Confirmed Historical Claim */}
          <label
            onClick={() => handleToggleConfirmedTagline(true)}
            className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
              Boolean(shop?.isOwnerConfirmedTagline)
                ? 'bg-amber-50/70 border-amber-400 text-amber-950'
                : 'bg-slate-50 border-mk-line text-slate-700'
            }`}
          >
            <input
              type="radio"
              name="taglineChoice"
              checked={Boolean(shop?.isOwnerConfirmedTagline)}
              onChange={() => handleToggleConfirmedTagline(true)}
              className="mt-1 accent-amber-600"
            />
            <div className="text-xs">
              <span className="font-bold text-sm block text-mk-text">
                "100 वर्षों से आपके विश्वास का साथ" ✨
              </span>
              <span className="text-amber-800">
                (मालिक द्वारा पुष्ट ऐतिहासिक दावा — Trusted for over 100 years)
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Two-Phone Sync Status Card */}
      <div className="bg-white p-4 rounded-3xl border border-mk-line shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-mk-purple" />
            <h3 className="font-bold text-base text-mk-text">
              {isHi ? 'दो-फोन क्लाउड सिंक (Two-Phone Sync)' : 'Two-Phone Cloud Sync'}
            </h3>
          </div>
          <span
            className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              isCloudConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isCloudConfigured ? (isHi ? 'क्लाउड कनेक्टेड' : 'Cloud Connected') : (isHi ? 'लोकल मोड' : 'Local Only')}
          </span>
        </div>

        <p className="text-xs text-mk-muted leading-relaxed">
          {isHi
            ? 'दुकान के दोनों फोन (पिताजी और माताजी) पर एक ही सामान व उधारी खाता सिंक रहेगा।'
            : 'Keeps both counters synchronized with identical inventory and khata ledger.'}
        </p>

        <div className="bg-slate-50 p-3 rounded-2xl border border-mk-line flex items-center justify-between">
          <div>
            <span className="text-xs text-mk-muted block">{isHi ? 'आउटबॉक्स कतार:' : 'Pending Outbox:'}</span>
            <span className="font-bold text-sm text-mk-text">
              {pendingOutboxCount === 0
                ? isHi ? 'सभी रिकॉर्ड सिंक हैं' : 'All synced'
                : `${pendingOutboxCount} ${isHi ? 'रिकॉर्ड बाकी हैं' : 'records pending'}`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-2xl bg-mk-purple hover:bg-mk-purple-dark text-white font-bold text-xs shadow-md shadow-mk-purple/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? (isHi ? 'सिंक हो रहा है...' : 'Syncing...') : (isHi ? 'अभी सिंक करें' : 'Sync Now')}</span>
          </button>
        </div>

        {syncMessage && (
          <p className="text-xs font-bold text-mk-purple bg-purple-50 p-2.5 rounded-xl border border-purple-200">
            {syncMessage}
          </p>
        )}

        {/* Link Second Phone Form */}
        <form onSubmit={handleLinkExistingShop} className="pt-2 border-t border-slate-100 space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            {isHi ? 'दूसरे फोन पर दुकान जोड़ें (Shop ID डालें):' : 'Link Second Phone (Enter Shop ID):'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={linkShopIdInput}
              onChange={(e) => setLinkShopIdInput(e.target.value)}
              placeholder="Shop ID paste here"
              className="flex-1 h-11 px-3 rounded-xl border border-slate-300 font-mono text-xs focus:border-mk-purple focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLinking}
              className="px-4 h-11 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl"
            >
              {isLinking ? '...' : isHi ? 'जोड़ें' : 'Link'}
            </button>
          </div>
        </form>
      </div>

      {/* Encrypted Backup & Restore Card */}
      <div className="bg-white p-4 rounded-3xl border border-mk-line shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-base text-mk-text">
            {isHi ? 'सुरक्षित एन्क्रिप्टेड बैकअप' : 'Encrypted Shop Backup'}
          </h3>
        </div>

        {/* Create Backup */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-mk-muted">
            {isHi ? 'बैकअप पासवर्ड बनाएं:' : 'Set Backup Password:'}
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={exportPassphrase}
              onChange={(e) => setExportPassphrase(e.target.value)}
              placeholder="••••••••"
              className="flex-1 h-11 px-3 rounded-xl border border-slate-300 font-bold text-sm focus:border-mk-purple focus:outline-none"
            />
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isExporting}
              className="px-4 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>{isHi ? 'डाउनलोड' : 'Download'}</span>
            </button>
          </div>
          {exportSuccess && (
            <p className="text-xs font-bold text-emerald-700">✓ बैकअप फाइल सफलतापूर्वक डाउनलोड हुई</p>
          )}
        </div>

        {/* Restore Backup */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <label className="block text-xs font-bold text-mk-muted">
            {isHi ? 'बैकअप फाइल से रीस्टोर करें:' : 'Restore from Backup File:'}
          </label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
          />

          {selectedFileText && (
            <div className="flex gap-2 pt-1">
              <input
                type="password"
                value={restorePassphrase}
                onChange={(e) => setRestorePassphrase(e.target.value)}
                placeholder={isHi ? 'बैकअप पासवर्ड डालें' : 'Enter backup password'}
                className="flex-1 h-11 px-3 rounded-xl border border-slate-300 font-bold text-sm focus:border-mk-purple focus:outline-none"
              />
              <button
                type="button"
                onClick={handlePreviewRestore}
                className="px-4 h-11 bg-slate-800 text-white font-bold text-xs rounded-xl"
              >
                {isHi ? 'जांचें' : 'Verify'}
              </button>
            </div>
          )}

          {restoreError && (
            <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-xl border border-red-200">
              {restoreError}
            </p>
          )}

          {restorePreview && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl space-y-2 text-xs">
              <p className="font-bold text-slate-800">
                दुकान: <span className="text-mk-purple">{restorePreview.shopName}</span>
              </p>
              <p className="text-slate-600">
                कुल सामान: {restorePreview.counts.inventory} | बिल: {restorePreview.counts.bills} | ग्राहक: {restorePreview.counts.customers}
              </p>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow"
              >
                {isRestoring ? 'रीस्टोर हो रहा है...' : 'पुष्टि करें व रीस्टोर करें'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
