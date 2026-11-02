import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Search,
  Mic,
  Info,
  CheckCircle,
  Share2,
  Printer,
  RotateCcw,
  Sparkles,
  UserPlus,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import type { Language } from '../../i18n';
import { translations } from '../../i18n';
import { db, seedDemoDataIfEmpty, type InventoryRecord } from '../../data/db';
import type { Customer } from '../../domain/ledger';
import { searchInventoryItems, type MatchResult } from '../../domain/matching';
import { calculateLineTotal, getCompatibleUnits, toBaseQuantity } from '../../domain/units';
import {
  calculateBillTotals,
  calculatePaymentSettlement,
  type Bill,
  type BillItemSnapshot,
  type PaymentSettlement,
} from '../../domain/billing';
import { getBasketSuggestions, type AssociationSuggestion } from '../../domain/associations';
import { formatINR } from '../../domain/money';
import { getTodayKolkataDate } from '../../domain/interest';
import { buildBillWhatsAppLink } from '../../integrations/whatsapp';
import { InfoModal, type InfoModalItem } from '../../components/InfoModal';
import { VoiceSearchEngine } from '../../integrations/speech';

interface BillingScreenProps {
  language: Language;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({ language }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = translations[language];
  const isHi = language === 'hi';

  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [historicalBills, setHistoricalBills] = useState<any[]>([]);

  // Active Bill State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [basket, setBasket] = useState<BillItemSnapshot[]>([]);
  const [discount, setDiscount] = useState<string>('0');

  // Active Row Inputs
  const [itemQuery, setItemQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MatchResult<InventoryRecord>[]>([]);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryRecord | null>(null);

  const [rateInput, setRateInput] = useState('');
  const [qtyInput, setQtyInput] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState('pc');
  const [compatibleUnits, setCompatibleUnits] = useState<any[]>([]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Settlement State
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'credit' | 'split'>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [cashPortion, setCashPortion] = useState('');
  const [upiPortion, setUpiPortion] = useState('');
  const [creditPortion, setCreditPortion] = useState('');
  const [isOwnerConfirmedUpi, setIsOwnerConfirmedUpi] = useState(false);

  // Modals & Popups
  const [modalItem, setModalItem] = useState<InfoModalItem | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const [savedBill, setSavedBill] = useState<Bill | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Quick Customer Creation Modal
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Voice Search
  const [isListening, setIsListening] = useState(false);
  const voiceEngineRef = useRef<VoiceSearchEngine | null>(null);

  // Suggestions
  const [suggestions, setSuggestions] = useState<AssociationSuggestion[]>([]);

  // Load Data & Restore Draft
  useEffect(() => {
    async function init() {
      await seedDemoDataIfEmpty();
      const inv = await db.inventory.filter((i) => i.isActive).toArray();
      setInventory(inv);

      const custs = await db.customers.filter((c) => c.isActive).toArray();
      setCustomers(custs);

      const bills = await db.bills.toArray();
      setHistoricalBills(bills);

      // Check preselected item from navigate state (e.g. from HomeScreen search)
      if (location.state && (location.state as any).preselectItem) {
        handleSelectItem((location.state as any).preselectItem);
      } else {
        // Restore Draft
        const draft = await db.drafts.get('active_bill_draft');
        if (draft?.data?.items?.length) {
          setBasket(draft.data.items);
          if (draft.data.customerId) {
            const foundCust = custs.find((c) => c.id === draft.data.customerId);
            if (foundCust) setSelectedCustomer(foundCust);
          }
        }
      }
    }
    init();
  }, []);

  // Save Draft on meaningful changes
  useEffect(() => {
    if (basket.length > 0) {
      db.drafts.put({
        key: 'active_bill_draft',
        data: {
          items: basket,
          customerId: selectedCustomer?.id,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });
    } else {
      db.drafts.delete('active_bill_draft');
    }
  }, [basket, selectedCustomer]);

  // Voice Search init
  useEffect(() => {
    voiceEngineRef.current = new VoiceSearchEngine(
      (state) => setIsListening(state === 'listening'),
      (text) => setItemQuery(text)
    );
    return () => voiceEngineRef.current?.stopListening();
  }, []);

  // Search Items
  useEffect(() => {
    if (!itemQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const res = searchInventoryItems(inventory, itemQuery, 5);
    setSearchResults(res);
  }, [itemQuery, inventory]);

  // Compute Market Basket Suggestions
  useEffect(() => {
    const activeIds = basket
      .map((b) => b.inventoryItemId)
      .filter((id): id is string => Boolean(id));

    const invLookup = new Map(
      inventory.map((i) => [
        i.id,
        {
          id: i.id,
          itemName: i.itemName,
          variantLabel: i.variantLabel,
          sellingPrice: Number(i.sellingPrice),
          baseUnit: i.baseUnit,
          isActive: i.isActive,
        },
      ])
    );
    const basketBills = historicalBills.map((b) => ({
      id: b.id,
      status: b.status,
      itemIds: b.items.map((it: any) => it.inventoryItemId).filter(Boolean),
    }));

    const suggs = getBasketSuggestions(activeIds, basketBills, invLookup, 3);
    setSuggestions(suggs);
  }, [basket, historicalBills, inventory]);

  const handleSelectItem = (item: InventoryRecord) => {
    setSelectedInventoryItem(item);
    setItemQuery(item.itemName);
    setRateInput(String(item.sellingPrice));
    setSelectedUnit(item.baseUnit);
    const comps = getCompatibleUnits(item.baseUnit);
    setCompatibleUnits(comps);
    setSearchResults([]);
  };

  const handleApplySuggestion = (sugg: AssociationSuggestion) => {
    const inv = inventory.find((i) => i.id === sugg.targetItemId);
    if (inv) {
      handleSelectItem(inv);
    }
  };

  // Add Item to Basket
  const handleAddOrUpdateItem = () => {
    const rate = parseFloat(rateInput);
    const qty = parseFloat(qtyInput);

    if (!itemQuery.trim()) {
      alert('सामान का नाम दर्ज करें');
      return;
    }
    if (isNaN(rate) || rate < 0) {
      alert('अमान्य दर (Invalid rate)');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      alert('अमान्य मात्रा (Invalid quantity)');
      return;
    }

    const baseUnit = selectedInventoryItem ? selectedInventoryItem.baseUnit : selectedUnit;
    const defaultRate = selectedInventoryItem ? Number(selectedInventoryItem.sellingPrice) : rate;
    const isOverridden = defaultRate !== rate;

    // Check if new/unseen item or variant
    const isUnseen = !selectedInventoryItem;
    const isNewPack = Boolean(selectedInventoryItem && selectedInventoryItem.sellingPrice !== rate);

    const baseQty = toBaseQuantity(qty, selectedUnit, baseUnit).toNumber();
    const lineTot = calculateLineTotal(rate, qty, selectedUnit, baseUnit).toNumber();

    const snapshot: BillItemSnapshot = {
      id: editingIndex !== null ? basket[editingIndex].id : `line-${Date.now()}`,
      inventoryItemId: selectedInventoryItem?.id,
      itemName: selectedInventoryItem ? selectedInventoryItem.itemName : itemQuery.trim(),
      variantLabel: selectedInventoryItem?.variantLabel,
      billingUnit: selectedUnit,
      baseUnit,
      defaultSellingPrice: defaultRate,
      ratePerBaseUnit: rate,
      isRateOverridden: isOverridden,
      quantity: qty,
      baseQuantity: baseQty,
      lineTotal: lineTot,
      costPriceSnapshot: selectedInventoryItem?.costPrice != null ? Number(selectedInventoryItem.costPrice) : null,
      isUnseenItem: isUnseen,
      isNewVariant: isNewPack,
    };

    if (editingIndex !== null) {
      const updated = [...basket];
      updated[editingIndex] = snapshot;
      setBasket(updated);
      setEditingIndex(null);
    } else {
      setBasket([...basket, snapshot]);
    }

    // Reset row inputs
    setItemQuery('');
    setSelectedInventoryItem(null);
    setRateInput('');
    setQtyInput('1');
    setSelectedUnit('pc');
    setCompatibleUnits([]);
  };

  const handleEditRow = (idx: number) => {
    const row = basket[idx];
    setEditingIndex(idx);
    setItemQuery(row.itemName);
    setRateInput(String(row.ratePerBaseUnit));
    setQtyInput(String(row.quantity));
    setSelectedUnit(row.billingUnit);

    const inv = inventory.find((i) => i.id === row.inventoryItemId);
    if (inv) {
      setSelectedInventoryItem(inv);
      setCompatibleUnits(getCompatibleUnits(inv.baseUnit));
    }
  };

  const handleDeleteRow = (idx: number) => {
    setBasket(basket.filter((_, i) => i !== idx));
  };

  // Bill Calculations
  const { subtotal, grandTotal } = calculateBillTotals(
    basket.map((b) => ({
      ratePerBaseUnit: b.ratePerBaseUnit,
      quantity: b.quantity,
      billingUnit: b.billingUnit,
      baseUnit: b.baseUnit,
    })),
    parseFloat(discount) || 0
  );

  // Save Bill
  const handleSaveBill = async () => {
    if (basket.length === 0) {
      setSubmitError('बिल में कम से कम एक सामान होना आवश्यक है');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    // Calculate settlement
    const settleRes = calculatePaymentSettlement(grandTotal, paymentMethod, {
      cashTendered: cashTendered ? parseFloat(cashTendered) : grandTotal,
      cashPortion: cashPortion ? parseFloat(cashPortion) : 0,
      upiPortion: upiPortion ? parseFloat(upiPortion) : 0,
      creditPortion: creditPortion ? parseFloat(creditPortion) : 0,
      isOwnerConfirmedUpi,
      customerId: selectedCustomer?.id,
    });

    if (!settleRes.valid || !settleRes.settlement) {
      setSubmitError(settleRes.error || 'भुगतान सत्यापन विफल');
      setIsSubmitting(false);
      return;
    }

    try {
      const billId = `bill-${Date.now()}`;
      const businessDate = getTodayKolkataDate();
      const receiptNo = `MKS-${businessDate.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

      const newBill: Bill = {
        id: billId,
        shopId: 'demo-munsi-kirana-001',
        receiptNumber: receiptNo,
        businessDate,
        items: basket,
        subtotal: subtotal.toNumber(),
        discount: parseFloat(discount) || 0,
        grandTotal: grandTotal.toNumber(),
        settlement: {
          ...settleRes.settlement,
          customerName: selectedCustomer?.name,
          customerPhone: selectedCustomer?.phone,
        },
        status: 'completed',
        createdAt: new Date().toISOString(),
        operationId: `op-${billId}`,
      };

      // 1. Transactionally save bill and credit charges
      await db.transaction('rw', [db.bills, db.credit_charges, db.inventory, db.drafts], async () => {
        await db.bills.add(newBill);

        // If credit remainder exists, record credit charge
        if (newBill.settlement.creditDue > 0 && selectedCustomer) {
          await db.credit_charges.add({
            id: `charge-${Date.now()}`,
            shopId: newBill.shopId,
            customerId: selectedCustomer.id,
            amount: newBill.settlement.creditDue,
            transactionDate: businessDate,
            reasonNotes: `बिल #${newBill.receiptNumber} से उधार`,
            linkedBillId: newBill.id,
            isReversed: false,
            createdAt: new Date().toISOString(),
          });
        }

        // 2. Unseen Item Auto-Learning
        for (const item of basket) {
          if (item.isUnseenItem && !item.inventoryItemId) {
            await db.inventory.add({
              id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              shopId: newBill.shopId,
              itemName: item.itemName,
              variantLabel: item.variantLabel || `${item.ratePerBaseUnit} Rs Pack`,
              sellingPrice: item.ratePerBaseUnit,
              baseUnit: item.baseUnit,
              aliases: [item.itemName.toLowerCase()],
              hindiKeywords: [],
              isActive: true,
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        // Clear active draft
        await db.drafts.delete('active_bill_draft');
      });

      setSavedBill(newBill);
      setBasket([]);
      setDiscount('0');
      setSelectedCustomer(null);
    } catch (err: any) {
      setSubmitError(err.message || 'बिल सुरक्षित करने में त्रुटि');
    } finally {
      setIsSubmitting(false);
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
    setIsInfoModalOpen(true);
  };

  const handleCreateCustomer = async () => {
    if (!newCustName.trim()) return;
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      shopId: 'demo-munsi-kirana-001',
      name: newCustName.trim(),
      phone: newCustPhone.trim() || undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.customers.add(newCust);
    setCustomers([...customers, newCust]);
    setSelectedCustomer(newCust);
    setIsNewCustomerModalOpen(false);
    setNewCustName('');
    setNewCustPhone('');
  };

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* Top Header & Segmented Tab */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-11 h-11 rounded-2xl bg-white border border-mk-line flex items-center justify-center text-mk-text hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        <div className="flex-1 grid grid-cols-2 bg-slate-200/80 p-1 rounded-2xl">
          <button
            type="button"
            className="py-2 rounded-xl bg-white font-bold text-sm text-mk-purple shadow-sm transition-all"
          >
            {t.createBill}
          </button>
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="py-2 rounded-xl font-bold text-sm text-mk-muted hover:text-mk-text transition-all"
          >
            {t.updateInventory}
          </button>
        </div>
      </div>

      {/* Optional Customer Selector */}
      <div className="bg-white p-3 rounded-2xl border border-mk-line shadow-sm flex items-center justify-between gap-2">
        <div className="flex-1">
          <select
            value={selectedCustomer?.id || ''}
            onChange={(e) => {
              const cust = customers.find((c) => c.id === e.target.value);
              setSelectedCustomer(cust || null);
            }}
            className="w-full bg-transparent font-bold text-sm text-mk-text focus:outline-none"
          >
            <option value="">{t.customerOptional}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ''}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setIsNewCustomerModalOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-mk-soft text-mk-purple text-xs font-bold hover:bg-mk-soft/80 flex items-center gap-1 flex-shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>{isHi ? 'नया ग्राहक' : '+ Customer'}</span>
        </button>
      </div>

      {/* Item Input Card */}
      <div className="bg-white p-4 rounded-3xl border border-mk-line shadow-sm space-y-3">
        {/* Search / Item Name Input */}
        <div className="relative">
          <div className="flex items-center gap-2 bg-slate-50 border border-mk-line rounded-2xl px-3 py-1 focus-within:border-mk-purple focus-within:ring-2 focus-within:ring-mk-soft transition-all">
            <Search className="w-5 h-5 text-mk-muted flex-shrink-0" />
            <input
              type="text"
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder={t.searchItemPlaceholder}
              className="w-full min-h-[46px] bg-transparent text-base font-bold text-mk-text placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => voiceEngineRef.current?.startListening(isHi ? 'hi-IN' : 'en-IN')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-700'
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>

          {/* Search Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white rounded-2xl border border-mk-line shadow-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {searchResults.map(({ item }) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className="p-3 hover:bg-mk-soft/40 cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <h5 className="font-bold text-sm text-mk-text">{item.itemName}</h5>
                    <span className="text-xs text-mk-muted">{item.variantLabel || item.baseUnit}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-mk-purple">{formatINR(item.sellingPrice)}</span>
                    <button
                      type="button"
                      onClick={(e) => handleOpenInfo(item, e)}
                      className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-mk-purple"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Badges for Rate Override & New Item Learning */}
        {selectedInventoryItem && Number(rateInput) !== Number(selectedInventoryItem.sellingPrice) && (
          <div className="p-2 bg-amber-50 rounded-xl border border-amber-200/60 text-xs font-semibold text-amber-900 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <span>{t.rateOverriddenBadge} (मूल दर ₹{selectedInventoryItem.sellingPrice})</span>
          </div>
        )}

        {!selectedInventoryItem && itemQuery.trim().length > 0 && (
          <div className="p-2 bg-purple-50 rounded-xl border border-purple-200/60 text-xs font-semibold text-mk-purple flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-mk-purple" />
            <span>{t.newPackBadge}</span>
          </div>
        )}

        {/* Rate, Quantity, Unit & Line Total Grid */}
        <div className="grid grid-cols-3 gap-2">
          {/* Rate */}
          <div>
            <label className="block text-[11px] font-bold text-mk-muted mb-1">{t.rate}</label>
            <input
              type="number"
              step="0.5"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              placeholder="0.00"
              className="w-full min-h-[50px] px-3 font-extrabold text-lg rounded-2xl bg-slate-50 border border-mk-line text-mk-text focus:outline-none focus:border-mk-purple"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-[11px] font-bold text-mk-muted mb-1">{t.qty}</label>
            <input
              type="number"
              step="0.05"
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              placeholder="1"
              className="w-full min-h-[50px] px-3 font-extrabold text-lg rounded-2xl bg-slate-50 border border-mk-line text-mk-text focus:outline-none focus:border-mk-purple"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-[11px] font-bold text-mk-muted mb-1">{t.unit}</label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full min-h-[50px] px-2 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line text-mk-text focus:outline-none focus:border-mk-purple"
            >
              {compatibleUnits.length > 0 ? (
                compatibleUnits.map((u) => (
                  <option key={u.code} value={u.code}>
                    {isHi ? u.labelHi : u.labelEn}
                  </option>
                ))
              ) : (
                <>
                  <option value="pc">{isHi ? 'नग (pc)' : 'pc'}</option>
                  <option value="kg">{isHi ? 'किलो (kg)' : 'kg'}</option>
                  <option value="g">{isHi ? 'ग्राम (g)' : 'g'}</option>
                  <option value="l">{isHi ? 'लीटर (l)' : 'litre'}</option>
                  <option value="ml">{isHi ? 'मिली (ml)' : 'ml'}</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Live Line Total Calculation & Add Button */}
        <div className="pt-2 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs text-mk-muted block">{t.lineTotal}</span>
            <span className="text-xl font-black text-mk-text">
              {formatINR(
                calculateLineTotal(
                  parseFloat(rateInput) || 0,
                  parseFloat(qtyInput) || 0,
                  selectedUnit,
                  selectedInventoryItem ? selectedInventoryItem.baseUnit : selectedUnit
                )
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddOrUpdateItem}
            className="flex-1 min-h-touch bg-mk-purple hover:bg-mk-purple-dark text-white font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-mk-purple/20 active:scale-[0.98] transition-all"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>{editingIndex !== null ? 'बदलाव सुरक्षित करें' : t.addItemToBasket}</span>
          </button>
        </div>
      </div>

      {/* Market Basket Apriori Suggestions Chips */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5 px-1">
          <span className="text-xs font-bold text-mk-muted uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {t.oftenBoughtTogether}
          </span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {suggestions.map((sugg) => (
              <button
                key={sugg.targetItemId}
                type="button"
                onClick={() => handleApplySuggestion(sugg)}
                className="px-3 py-1.5 rounded-xl bg-white border border-mk-line hover:border-mk-purple text-xs font-bold text-mk-text flex items-center gap-1.5 shadow-sm flex-shrink-0 transition-colors"
              >
                <span>{sugg.targetItemName}</span>
                <span className="text-mk-purple font-extrabold">{formatINR(sugg.defaultSellingPrice)}</span>
                <Plus className="w-3.5 h-3.5 text-mk-purple" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Customer's Basket List */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-mk-muted uppercase tracking-wider px-1">
          {t.basket} ({basket.length})
        </h3>

        {basket.length === 0 ? (
          <div className="p-6 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-slate-400">
            <p className="text-sm font-medium">{t.basketEmpty}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {basket.map((item, idx) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-white border border-mk-line shadow-sm flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-base text-mk-text truncate">{item.itemName}</h4>
                  <p className="text-xs text-mk-muted mt-0.5">
                    {item.quantity} {item.billingUnit} × ₹{item.ratePerBaseUnit}
                    {item.isRateOverridden && (
                      <span className="ml-1 text-[11px] text-amber-700 font-bold">(छूट दर)</span>
                    )}
                  </p>
                </div>

                <div className="text-right flex items-center gap-2">
                  <span className="text-lg font-black text-mk-text">{formatINR(item.lineTotal)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEditRow(idx)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(idx)}
                      className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Method & Settlement */}
      {basket.length > 0 && (
        <div className="bg-white p-4 rounded-3xl border border-mk-line shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-mk-text uppercase tracking-wider">
            {t.paymentMethod}
          </h3>

          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'cash', label: t.cash },
              { id: 'upi', label: t.upi },
              { id: 'credit', label: t.creditUdhaar },
              { id: 'split', label: t.splitPayment },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id as any)}
                className={`min-h-[48px] px-2 py-1 rounded-2xl font-bold text-xs transition-all ${
                  paymentMethod === m.id
                    ? 'bg-mk-purple text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Cash Tendered & Change Returned */}
          {paymentMethod === 'cash' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-mk-muted mb-1">{t.tenderedCash}</label>
                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={grandTotal.toFixed(2)}
                  className="w-full min-h-[48px] px-3 font-extrabold text-lg rounded-2xl bg-slate-50 border border-mk-line text-mk-text"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-mk-muted mb-1">{t.changeToReturn}</label>
                <div className="min-h-[48px] px-3 font-black text-lg rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-center">
                  {cashTendered && parseFloat(cashTendered) >= grandTotal.toNumber()
                    ? formatINR(parseFloat(cashTendered) - grandTotal.toNumber())
                    : '₹0.00'}
                </div>
              </div>
            </div>
          )}

          {/* UPI Confirmation Checkbox */}
          {paymentMethod === 'upi' && (
            <label className="flex items-center gap-3 p-3 rounded-2xl bg-purple-50 border border-purple-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isOwnerConfirmedUpi}
                onChange={(e) => setIsOwnerConfirmedUpi(e.target.checked)}
                className="w-5 h-5 rounded text-mk-purple accent-mk-purple"
              />
              <span className="text-xs font-bold text-mk-purple leading-snug">
                {t.upiConfirmation}
              </span>
            </label>
          )}

          {/* Credit Check */}
          {paymentMethod === 'credit' && !selectedCustomer && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800">
              {isHi ? 'उधार बिल के लिए ऊपर ग्राहक चुनना अनिवार्य है!' : 'Customer selection required for credit bill!'}
            </div>
          )}

          {/* Split Inputs */}
          {paymentMethod === 'split' && (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-mk-muted mb-1">नकद (Cash)</label>
                  <input
                    type="number"
                    value={cashPortion}
                    onChange={(e) => setCashPortion(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[46px] px-2 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-mk-muted mb-1">UPI</label>
                  <input
                    type="number"
                    value={upiPortion}
                    onChange={(e) => setUpiPortion(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[46px] px-2 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-mk-muted mb-1">उधार (Due)</label>
                  <input
                    type="number"
                    value={creditPortion}
                    onChange={(e) => setCreditPortion(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[46px] px-2 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
                  />
                </div>
              </div>

              {parseFloat(upiPortion) > 0 && (
                <label className="flex items-center gap-2 p-2 rounded-xl bg-purple-50 text-xs font-semibold text-mk-purple">
                  <input
                    type="checkbox"
                    checked={isOwnerConfirmedUpi}
                    onChange={(e) => setIsOwnerConfirmedUpi(e.target.checked)}
                    className="accent-mk-purple"
                  />
                  <span>UPI प्राप्त होने की पुष्टि करें</span>
                </label>
              )}
            </div>
          )}

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-700">
              {submitError}
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Bill Total & Save Action */}
      {basket.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-20 bg-white border-t border-mk-line px-4 py-3 shadow-[0_-8px_20px_rgba(0,0,0,0.06)]">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-mk-muted uppercase block">{t.grandTotal}</span>
              <span className="text-2xl font-black text-mk-text">{formatINR(grandTotal)}</span>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveBill}
              className="min-h-touch px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-lg rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <CheckCircle className="w-5 h-5 stroke-[2.5]" />
              <span>{isSubmitting ? 'सुरक्षित हो रहा है...' : t.saveAndGenerateBill}</span>
            </button>
          </div>
        </div>
      )}

      {/* Bill Success / Receipt Preview Modal */}
      {savedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-mk-line overflow-hidden p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="text-center space-y-1">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-2">
                <CheckCircle className="w-8 h-8 stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-black text-mk-text">{t.billSavedSuccess}</h3>
              <p className="text-xs text-mk-muted font-bold">
                #{savedBill.receiptNumber} • {savedBill.businessDate}
              </p>
            </div>

            {/* Itemized Table */}
            <div className="border-t border-b border-dashed border-slate-200 py-3 space-y-2 text-xs">
              {savedBill.items.map((it) => (
                <div key={it.id} className="flex justify-between items-center">
                  <span className="font-semibold text-mk-text">
                    {it.itemName} ({it.quantity} {it.billingUnit})
                  </span>
                  <span className="font-bold text-mk-text">{formatINR(it.lineTotal)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 flex justify-between font-black text-base text-mk-text">
                <span>{t.grandTotal}</span>
                <span>{formatINR(savedBill.grandTotal)}</span>
              </div>
              {savedBill.settlement.creditDue > 0 && (
                <div className="flex justify-between font-bold text-amber-700">
                  <span>{t.balanceDue}</span>
                  <span>{formatINR(savedBill.settlement.creditDue)}</span>
                </div>
              )}
            </div>

            {/* Actions: Send WhatsApp & Next Bill */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const link = buildBillWhatsAppLink(
                    savedBill,
                    savedBill.settlement.customerPhone,
                    'मुंशी किराना स्टोर'
                  );
                  if (link.url) window.open(link.url, '_blank');
                }}
                className="w-full min-h-touch bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all"
              >
                <Share2 className="w-5 h-5 stroke-[2.5]" />
                <span>{t.sendWhatsApp}</span>
              </button>

              <button
                type="button"
                onClick={() => setSavedBill(null)}
                className="w-full min-h-touch bg-slate-100 hover:bg-slate-200 text-mk-text font-bold text-base rounded-2xl transition-colors"
              >
                {t.newBillBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4">
            <h3 className="font-bold text-lg text-mk-text">नया ग्राहक जोड़ें</h3>
            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">ग्राहक का नाम</label>
              <input
                type="text"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="उदा. रमेश कुमार"
                className="w-full min-h-[46px] px-3 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">फोन नंबर (वैकल्पिक)</label>
              <input
                type="tel"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full min-h-[46px] px-3 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 font-bold rounded-xl"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
                className="flex-1 py-3 bg-mk-purple text-white font-bold rounded-xl"
              >
                जोड़ें
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Private Info Modal */}
      <InfoModal
        item={modalItem}
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        language={language}
      />
    </div>
  );
};
