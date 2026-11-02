import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  CheckSquare,
  Square,
  Upload,
  Image as ImageIcon,
  Info,
  Edit2,
  Trash2,
  Lock,
  FileCheck,
} from 'lucide-react';
import type { Language } from '../../i18n';
import { translations } from '../../i18n';
import { db, seedDemoDataIfEmpty, type InventoryRecord, type AttachmentRecord } from '../../data/db';
import { searchInventoryItems } from '../../domain/matching';
import { compressWholesalePhoto } from '../../integrations/imageCompression';
import { InfoModal, type InfoModalItem } from '../../components/InfoModal';
import { formatINR } from '../../domain/money';

interface InventoryScreenProps {
  language: Language;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({ language }) => {
  const navigate = useNavigate();
  const t = translations[language];
  const isHi = language === 'hi';

  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [hindiNameInput, setHindiNameInput] = useState('');
  const [variantInput, setVariantInput] = useState('');
  const [aliasesInput, setAliasesInput] = useState('');
  const [sellingPriceInput, setSellingPriceInput] = useState('');
  const [costPriceInput, setCostPriceInput] = useState('');
  const [unitInput, setUnitInput] = useState('pc');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Wholesale Upload State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  // Private Info Modal
  const [modalItem, setModalItem] = useState<InfoModalItem | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const loadItems = async () => {
    await seedDemoDataIfEmpty();
    const items = await db.inventory.filter((i) => i.isActive).toArray();
    setInventory(items);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const filteredItems = searchQuery.trim()
    ? searchInventoryItems(inventory, searchQuery, 50).map((r) => r.item)
    : inventory;

  const handleToggleSelect = (id: string) => {
    const updated = new Set(selectedItemIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedItemIds(updated);
  };

  const handleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  // Save Item (Add or Edit)
  const handleSaveItem = async () => {
    if (!nameInput.trim() || !sellingPriceInput) {
      alert('कृपया नाम और बिक्री दर दर्ज करें');
      return;
    }

    const aliases = aliasesInput
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const record: InventoryRecord = {
      id: editingItemId || `inv-${Date.now()}`,
      shopId: 'demo-munsi-kirana-001',
      itemName: nameInput.trim(),
      hindiName: hindiNameInput.trim() || undefined,
      variantLabel: variantInput.trim() || undefined,
      barcode: barcodeInput.trim() || undefined,
      sellingPrice: parseFloat(sellingPriceInput),
      costPrice: costPriceInput ? parseFloat(costPriceInput) : null,
      baseUnit: unitInput,
      aliases,
      hindiKeywords: hindiNameInput ? [hindiNameInput.trim()] : [],
      isActive: true,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingItemId) {
      await db.inventory.put(record);
    } else {
      await db.inventory.add(record);
    }

    setIsFormOpen(false);
    setEditingItemId(null);
    resetForm();
    await loadItems();
  };

  const resetForm = () => {
    setNameInput('');
    setHindiNameInput('');
    setVariantInput('');
    setAliasesInput('');
    setSellingPriceInput('');
    setCostPriceInput('');
    setBarcodeInput('');
    setUnitInput('pc');
  };

  const handleEditClick = (item: InventoryRecord) => {
    setEditingItemId(item.id);
    setNameInput(item.itemName);
    setHindiNameInput(item.hindiName || '');
    setVariantInput(item.variantLabel || '');
    setBarcodeInput(item.barcode || '');
    setAliasesInput((item.aliases || []).join(', '));
    setSellingPriceInput(String(item.sellingPrice));
    setCostPriceInput(item.costPrice != null ? String(item.costPrice) : '');
    setUnitInput(item.baseUnit);
    setIsFormOpen(true);
  };

  // Bulk Wholesale Bill Photo Upload
  const handleWholesaleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || selectedItemIds.size === 0) return;

    setIsUploading(true);
    setUploadMessage('फोटो कंप्रेस की जा रही है...');

    try {
      const compressed = await compressWholesalePhoto(file, 1400, 0.75);
      const attachmentId = `attach-${Date.now()}`;

      // Save attachment
      const attachRecord: AttachmentRecord = {
        id: attachmentId,
        shopId: 'demo-munsi-kirana-001',
        fileName: file.name,
        mimeType: 'image/jpeg',
        fileSizeBytes: compressed.compressedSizeBytes,
        base64Data: compressed.dataUrl,
        createdAt: new Date().toISOString(),
      };
      await db.attachments.add(attachRecord);

      // Join to all selected items
      const selectedIds = Array.from(selectedItemIds);
      for (const itemId of selectedIds) {
        await db.inventory_attachments.add({
          id: `join-${itemId}-${attachmentId}`,
          inventoryItemId: itemId,
          attachmentId,
          createdAt: new Date().toISOString(),
        });
      }

      setUploadMessage(
        `✓ ${selectedIds.length} सामानों से थोक बिल पर्ची सफलतापूर्वक लिंक हो गई (${Math.round(
          compressed.compressedSizeBytes / 1024
        )} KB)`
      );
      setSelectedItemIds(new Set());
    } catch (err: any) {
      alert(err.message || 'फोटो अपलोड करने में त्रुटि');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenInfo = async (item: InventoryRecord, e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if attachment exists for this item
    const joins = await db.inventory_attachments
      .where('inventoryItemId')
      .equals(item.id)
      .toArray();

    let imageUrl: string | undefined = undefined;
    if (joins.length > 0) {
      const att = await db.attachments.get(joins[0].attachmentId);
      if (att && att.base64Data) {
        imageUrl = att.base64Data;
      }
    }

    setModalItem({
      itemName: item.itemName,
      variantLabel: item.variantLabel,
      sellingPrice: Number(item.sellingPrice),
      costPrice: item.costPrice != null ? Number(item.costPrice) : null,
      baseUnit: item.baseUnit,
      wholesaleImageUrl: imageUrl,
    });
    setIsInfoModalOpen(true);
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
          <h2 className="text-xl font-bold text-mk-text leading-tight">
            {t.updateInventory} ({inventory.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingItemId(null);
            resetForm();
            setIsFormOpen(true);
          }}
          className="px-4 py-2.5 bg-mk-purple hover:bg-mk-purple-dark text-white font-bold text-sm rounded-2xl flex items-center gap-1.5 shadow-md shadow-mk-purple/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{isHi ? '+ सामान जोड़ें' : '+ Add Item'}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-2.5 rounded-2xl border border-mk-line shadow-sm flex items-center gap-2">
        <Search className="w-5 h-5 text-mk-muted flex-shrink-0 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isHi ? 'सामान खोजें...' : 'Search inventory...'}
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

      {/* Bulk Wholesale Attachment Toolbar */}
      {selectedItemIds.size > 0 && (
        <div className="p-4 bg-purple-50 border-2 border-mk-purple rounded-3xl shadow-md flex items-center justify-between gap-3 animate-scale-up">
          <div>
            <span className="font-extrabold text-sm text-mk-purple block">
              {selectedItemIds.size} {isHi ? 'सामान चुने गए हैं' : 'items selected'}
            </span>
            <span className="text-xs text-purple-700">
              {isHi ? 'एक ही थोक बिल फोटो सभी से जोड़ें' : 'Attach one wholesale bill to all'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleWholesaleFileChange}
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 bg-mk-purple text-white text-xs font-bold rounded-2xl flex items-center gap-1.5 shadow active:scale-95 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>{isUploading ? 'अपलोड...' : isHi ? 'बिल फोटो जोड़ें' : 'Upload Bill'}</span>
            </button>
          </div>
        </div>
      )}

      {uploadMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800">
          {uploadMessage}
        </div>
      )}

      {/* Select All Toggle Bar */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-xs font-bold text-mk-purple flex items-center gap-1.5 hover:underline"
        >
          {selectedItemIds.size === filteredItems.length && filteredItems.length > 0 ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          <span>{isHi ? 'सभी चुनें (Select All)' : 'Select All'}</span>
        </button>

        <span className="text-xs text-mk-muted font-medium">
          {filteredItems.length} {isHi ? 'आइटम' : 'items'}
        </span>
      </div>

      {/* Items List */}
      <div className="space-y-2.5">
        {filteredItems.map((item) => {
          const isSelected = selectedItemIds.has(item.id);

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl bg-white border shadow-sm flex items-center justify-between gap-3 transition-all ${
                isSelected ? 'border-mk-purple ring-2 ring-mk-soft' : 'border-mk-line'
              }`}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => handleToggleSelect(item.id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-mk-purple hover:bg-slate-100 flex-shrink-0"
              >
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-mk-purple fill-mk-soft" />
                ) : (
                  <Square className="w-5 h-5 text-slate-300" />
                )}
              </button>

              {/* Item Details */}
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-base text-mk-text truncate">
                  {item.itemName}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {item.variantLabel && (
                    <span className="px-2 py-0.5 bg-mk-soft text-mk-purple text-[11px] font-bold rounded-lg">
                      {item.variantLabel}
                    </span>
                  )}
                  {item.hindiName && (
                    <span className="text-xs text-mk-muted">{item.hindiName}</span>
                  )}
                  {item.barcode && (
                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-mono font-bold rounded border border-amber-200">
                      #{item.barcode}
                    </span>
                  )}
                </div>
              </div>

              {/* Price & Actions */}
              <div className="text-right flex items-center gap-2 flex-shrink-0">
                <div>
                  <span className="text-lg font-black text-mk-text">
                    {formatINR(item.sellingPrice)}
                  </span>
                  <span className="text-xs text-mk-muted block">/{item.baseUnit}</span>
                </div>

                {/* Info (i) Button */}
                <button
                  type="button"
                  onClick={(e) => handleOpenInfo(item, e)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-mk-purple flex items-center justify-center shadow-sm"
                  title="खरीद लागत व थोक बिल"
                >
                  <Info className="w-4 h-4 stroke-[2.2]" />
                </button>

                {/* Edit Button */}
                <button
                  type="button"
                  onClick={() => handleEditClick(item)}
                  className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Item Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-lg text-mk-text">
              {editingItemId ? (isHi ? 'सामान बदलें' : 'Edit Item') : isHi ? 'नया सामान जोड़ें' : 'Add Item'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">
                {isHi ? 'सामान का नाम (अंग्रेजी/हिंदी)' : 'Item Name'} *
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="उदा. Sugar, Vim, तेल"
                className="w-full min-h-[46px] px-3 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">
                {isHi ? 'हिंदी नाम (वैकल्पिक)' : 'Hindi Name'}
              </label>
              <input
                type="text"
                value={hindiNameInput}
                onChange={(e) => setHindiNameInput(e.target.value)}
                placeholder="उदा. चीनी, मूंगफली का तेल"
                className="w-full min-h-[46px] px-3 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-mk-muted mb-1">
                  {isHi ? 'पैक / वजन' : 'Variant / Pack'}
                </label>
                <input
                  type="text"
                  value={variantInput}
                  onChange={(e) => setVariantInput(e.target.value)}
                  placeholder="उदा. 1 kg, ₹30 Pack"
                  className="w-full min-h-[46px] px-3 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-mk-muted mb-1">
                  {isHi ? 'इकाई (Unit)' : 'Unit'}
                </label>
                <select
                  value={unitInput}
                  onChange={(e) => setUnitInput(e.target.value)}
                  className="w-full min-h-[46px] px-2 font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
                >
                  <option value="pc">नग (pc)</option>
                  <option value="kg">किलो (kg)</option>
                  <option value="l">लीटर (l)</option>
                  <option value="pack">पैकेट (pack)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-mk-muted mb-1">
                  {isHi ? 'बिक्री दर (₹)' : 'Selling Price'} *
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={sellingPriceInput}
                  onChange={(e) => setSellingPriceInput(e.target.value)}
                  placeholder="60"
                  className="w-full min-h-[46px] px-3 font-extrabold text-lg rounded-2xl bg-slate-50 border border-mk-line"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {isHi ? 'खरीद लागत (₹)' : 'Purchase Cost'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={costPriceInput}
                  onChange={(e) => setCostPriceInput(e.target.value)}
                  placeholder="54"
                  className="w-full min-h-[46px] px-3 font-extrabold text-lg rounded-2xl bg-amber-50/50 border border-amber-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">
                {isHi ? 'बारकोड / Barcode (वैकल्पिक)' : 'Barcode (Optional)'}
              </label>
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="8901030383749"
                className="w-full min-h-[46px] px-3 font-mono font-bold text-base rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-mk-muted mb-1">
                {isHi ? 'खोज उपनाम / Aliases (अल्पविराम से अलग)' : 'Search Aliases (comma separated)'}
              </label>
              <input
                type="text"
                value={aliasesInput}
                onChange={(e) => setAliasesInput(e.target.value)}
                placeholder="chini, shakkar, cheeni"
                className="w-full min-h-[46px] px-3 font-medium text-sm rounded-2xl bg-slate-50 border border-mk-line"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 font-bold rounded-2xl text-mk-text"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                className="flex-1 py-3 bg-mk-purple hover:bg-mk-purple-dark text-white font-bold rounded-2xl shadow"
              >
                सुरक्षित करें
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

