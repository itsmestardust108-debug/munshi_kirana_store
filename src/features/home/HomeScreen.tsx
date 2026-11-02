import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Search,
  ReceiptText,
  PackagePlus,
  Calculator,
  BookOpenCheck,
  Info,
  Clock,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { Language } from '../../i18n';
import { translations } from '../../i18n';
import { db, seedDemoDataIfEmpty, type InventoryRecord } from '../../data/db';
import { searchInventoryItems, type MatchResult } from '../../domain/matching';
import { VoiceSearchEngine, type SpeechState } from '../../integrations/speech';
import { InfoModal, type InfoModalItem } from '../../components/InfoModal';
import { formatINR } from '../../domain/money';

interface HomeScreenProps {
  language: Language;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ language }) => {
  const navigate = useNavigate();
  const t = translations[language];
  const isHi = language === 'hi';

  const [query, setQuery] = useState('');
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [searchResults, setSearchResults] = useState<MatchResult<InventoryRecord>[]>([]);
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const [speechError, setSpeechError] = useState<string | null>(null);

  const [modalItem, setModalItem] = useState<InfoModalItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [hasDraft, setHasDraft] = useState(false);
  const [recentBills, setRecentBills] = useState<any[]>([]);

  const voiceEngineRef = useRef<VoiceSearchEngine | null>(null);

  // Initialize data
  useEffect(() => {
    async function loadData() {
      await seedDemoDataIfEmpty();
      const items = await db.inventory.filter((i) => i.isActive).toArray();
      setInventory(items);

      // Check draft
      const draft = await db.drafts.get('active_bill_draft');
      if (draft && draft.data && draft.data.items && draft.data.items.length > 0) {
        setHasDraft(true);
      }

      // Check recent bills
      const bills = await db.bills.orderBy('createdAt').reverse().limit(3).toArray();
      setRecentBills(bills);
    }
    loadData();
  }, []);

  // Initialize Speech Engine
  useEffect(() => {
    voiceEngineRef.current = new VoiceSearchEngine(
      (state, err) => {
        setSpeechState(state);
        if (err) setSpeechError(err);
      },
      (transcript) => {
        setQuery(transcript);
        setSpeechError(null);
      }
    );

    return () => {
      voiceEngineRef.current?.stopListening();
    };
  }, []);

  // Update search results on query change
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const results = searchInventoryItems(inventory, query, 5);
    setSearchResults(results);
  }, [query, inventory]);

  const toggleMic = () => {
    if (speechState === 'listening') {
      voiceEngineRef.current?.stopListening();
    } else {
      setSpeechError(null);
      voiceEngineRef.current?.startListening(isHi ? 'hi-IN' : 'en-IN');
    }
  };

  const handleOpenInfo = (item: InventoryRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalItem({
      itemName: item.itemName,
      variantLabel: item.variantLabel,
      sellingPrice: Number(item.sellingPrice),
      costPrice: item.costPrice != null ? Number(item.costPrice) : null,
      baseUnit: item.baseUnit,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="p-4 space-y-5">
      {/* Search & Voice Rate Lookup Card */}
      <div className="bg-white p-3.5 rounded-3xl border border-mk-line shadow-sm space-y-2.5">
        <div className="flex items-center gap-2 bg-slate-50 border border-mk-line rounded-2xl px-3 py-1 focus-within:border-mk-purple focus-within:ring-2 focus-within:ring-mk-soft transition-all">
          <Search className="w-5 h-5 text-mk-muted flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full min-h-[46px] bg-transparent text-base font-semibold text-mk-text placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-1.5 py-1"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={toggleMic}
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
              speechState === 'listening'
                ? 'bg-red-500 text-white animate-pulse shadow-md ring-4 ring-red-100'
                : 'bg-mk-purple hover:bg-mk-purple-dark text-white shadow-sm'
            }`}
            aria-label="Voice search"
            title={t.micPrompt}
          >
            {speechState === 'listening' ? (
              <Mic className="w-6 h-6 animate-bounce" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Listening / Error Indicator */}
        {speechState === 'listening' && (
          <p className="text-xs font-bold text-red-600 flex items-center gap-1.5 px-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-600" />
            {t.listening}
          </p>
        )}
        {speechError && (
          <p className="text-xs font-semibold text-amber-700 px-2">{speechError}</p>
        )}

        {/* Search Results Dropdown Cards */}
        {searchResults.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-xs font-bold text-mk-muted uppercase tracking-wider block px-1">
              {isHi ? 'खोज परिणाम (भाव देखें)' : 'Matching Items (Rate Check)'}
            </span>
            {searchResults.map(({ item }) => (
              <div
                key={item.id}
                onClick={() => navigate('/billing', { state: { preselectItem: item } })}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-mk-soft/40 border border-slate-200/80 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <h4 className="font-bold text-base text-mk-text truncate">
                    {item.itemName}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {item.hindiName && (
                      <span className="text-xs text-mk-muted">{item.hindiName}</span>
                    )}
                    {item.variantLabel && (
                      <span className="px-1.5 py-0.5 bg-white border border-slate-200 text-mk-purple text-[11px] font-bold rounded">
                        {item.variantLabel}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-mk-text">
                      {formatINR(item.sellingPrice)}
                    </span>
                    <span className="text-xs text-mk-muted block">/{item.baseUnit}</span>
                  </div>

                  {/* Private Info Button (i) */}
                  <button
                    type="button"
                    onClick={(e) => handleOpenInfo(item, e)}
                    className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 active:bg-slate-200 text-mk-purple border border-slate-200 flex items-center justify-center shadow-sm"
                    title={t.costPriceInfo}
                    aria-label="View cost and wholesale bill"
                  >
                    <Info className="w-5 h-5 stroke-[2.2]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Example Prompt Chips when query is empty */}
        {!query && (
          <div className="flex items-center gap-2 pt-1 text-xs text-mk-muted overflow-x-auto no-scrollbar">
            <span className="flex-shrink-0 font-medium">{isHi ? 'उदा.:' : 'Try:'}</span>
            {['चीनी', 'SU', 'mungfali ka tel', 'विम'].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setQuery(chip)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex-shrink-0 transition-colors"
              >
                "{chip}"
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Draft Recovery Banner if present */}
      {hasDraft && (
        <div
          onClick={() => navigate('/billing')}
          className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-200/70 text-amber-900 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-bold text-sm text-amber-900 leading-tight">
                {isHi ? 'अधूरा बिल सुरक्षित है' : 'Saved Draft Available'}
              </h5>
              <p className="text-xs text-amber-700 mt-0.5">
                {isHi ? 'ग्राहक का बिल वहीं से आगे बढ़ाएँ' : 'Resume in-progress bill'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-amber-800" />
        </div>
      )}

      {/* Main 2x2 PhonePe-Style Navigation Tiles */}
      <div>
        <h2 className="text-sm font-bold text-mk-muted uppercase tracking-wider mb-2.5 px-1">
          {isHi ? 'मुख्य सेवाएँ' : 'Quick Actions'}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Tile 1: Create Bill (Featured Deep Purple) */}
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="p-4 rounded-3xl bg-mk-purple hover:bg-mk-purple-dark text-white text-left shadow-lg shadow-mk-purple/20 flex flex-col justify-between min-h-[142px] border border-mk-purple transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white">
              <ReceiptText className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl leading-tight">
                {t.tileNewBill}
              </h3>
              <p className="text-xs text-purple-200 mt-1">{t.tileNewBillSub}</p>
            </div>
          </button>

          {/* Tile 2: Add / Update Items */}
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="p-4 rounded-3xl bg-white hover:bg-slate-50 text-mk-text text-left shadow-sm border border-mk-line flex flex-col justify-between min-h-[142px] transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-2xl bg-mk-soft text-mk-purple flex items-center justify-center">
              <PackagePlus className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl leading-tight">
                {t.tileInventory}
              </h3>
              <p className="text-xs text-mk-muted mt-1">{t.tileInventorySub}</p>
            </div>
          </button>

          {/* Tile 3: Byaj Compound Interest Calculator */}
          <button
            type="button"
            onClick={() => navigate('/interest')}
            className="p-4 rounded-3xl bg-white hover:bg-slate-50 text-mk-text text-left shadow-sm border border-mk-line flex flex-col justify-between min-h-[142px] transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <Calculator className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl leading-tight">
                {t.tileByaj}
              </h3>
              <p className="text-xs text-mk-muted mt-1">{t.tileByajSub}</p>
            </div>
          </button>

          {/* Tile 4: Credit Ledger (Khata) */}
          <button
            type="button"
            onClick={() => navigate('/ledger')}
            className="p-4 rounded-3xl bg-white hover:bg-slate-50 text-mk-text text-left shadow-sm border border-mk-line flex flex-col justify-between min-h-[142px] transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <BookOpenCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl leading-tight">
                {t.tileKhata}
              </h3>
              <p className="text-xs text-mk-muted mt-1">{t.tileKhataSub}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Bills List */}
      {recentBills.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-mk-muted uppercase tracking-wider">
              {isHi ? 'हाल के बिल' : 'Recent Bills'}
            </h3>
            <button
              type="button"
              onClick={() => navigate('/bills')}
              className="text-xs font-bold text-mk-purple hover:underline"
            >
              {isHi ? 'सभी देखें →' : 'View All →'}
            </button>
          </div>

          <div className="space-y-2">
            {recentBills.map((b) => (
              <div
                key={b.id}
                onClick={() => navigate(`/bills/${b.id}`)}
                className="p-3.5 rounded-2xl bg-white border border-mk-line shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 active:scale-[0.99] transition-all"
              >
                <div>
                  <h4 className="font-bold text-base text-mk-text">
                    #{b.receiptNumber}
                  </h4>
                  <p className="text-xs text-mk-muted mt-0.5">
                    {b.businessDate} • {b.items.length} {isHi ? 'सामान' : 'items'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-extrabold text-mk-text">
                    {formatINR(b.grandTotal)}
                  </span>
                  <span
                    className={`block text-[11px] font-bold uppercase ${
                      b.settlement.creditDue > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {b.settlement.method}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Private Info Modal */}
      <InfoModal
        item={modalItem}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        language={language}
      />
    </div>
  );
};

