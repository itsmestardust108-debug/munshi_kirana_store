import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Check, Barcode as BarcodeIcon, Plus, AlertCircle, Loader2 } from 'lucide-react';
import type { InventoryRecord } from '../data/db';
import { roundPaise } from '../domain/money';
import { lookupBarcodeProduct } from '../integrations/barcodeLookup';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryRecord[];
  onItemScanned: (item: InventoryRecord) => void;
  onNewBarcodeRegister: (itemData: {
    barcode: string;
    itemName: string;
    sellingPrice: number;
    baseUnit: string;
  }) => Promise<InventoryRecord>;
  language: 'hi' | 'en';
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // High clear A6 beep
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } catch {
    // Ignore audio failures if permissions not granted
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onItemScanned,
  onNewBarcodeRegister,
  language,
}) => {
  const isHi = language === 'hi';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // New item registration state when unseen barcode is scanned
  const [unseenBarcode, setUnseenBarcode] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('pc');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setUnseenBarcode(null);
      setManualCode('');
      setLastScannedCode(null);
      setIsLookingUp(false);
      setLookupMessage(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(isHi ? 'कैमरा समर्थित नहीं है' : 'Camera not supported on this browser');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        startDetectionLoop();
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError(
        isHi
          ? 'कैमरा अनुमति अस्वीकृत या अनुपलब्ध (नीचे बारकोड दर्ज करें)'
          : 'Camera permission denied or unavailable (Enter code below)'
      );
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleBarcodeIdentified = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode || cleanCode === lastScannedCode) return;

    setLastScannedCode(cleanCode);
    playBeep();

    // Check if exists in inventory
    const found = inventory.find(
      (item) => item.barcode === cleanCode || item.itemName.toLowerCase() === cleanCode.toLowerCase()
    );

    if (found) {
      onItemScanned(found);
      // Brief pause before allowing next scan
      setTimeout(() => {
        setLastScannedCode(null);
      }, 1500);
    } else {
      // Unseen item! Pause camera loop and query live online & offline catalog
      setUnseenBarcode(cleanCode);
      setNewItemName('');
      setNewItemPrice('');
      setNewItemUnit('pc');
      setIsLookingUp(true);
      setLookupMessage(isHi ? 'सामान का नाम खोज रहे हैं...' : 'Looking up product name...');

      lookupBarcodeProduct(cleanCode)
        .then((info) => {
          setIsLookingUp(false);
          if (info && info.name) {
            setNewItemName(info.name);
            if (info.unit) setNewItemUnit(info.unit);
            if (info.typicalPrice) setNewItemPrice(String(info.typicalPrice));
            setLookupMessage(
              info.source === 'curated-offline'
                ? (isHi ? '✅ किराना कैटलॉग से पहचाना गया' : '✅ Identified from Kirana Catalog')
                : (isHi ? '✅ ऑनलाइन कैटलॉग से नाम मिला' : '✅ Name found from Online Catalog')
            );
          } else {
            setLookupMessage(
              isHi
                ? 'ℹ️ बारकोड में केवल 13 अंक होते हैं। दुकान की दर एक बार सेट करें।'
                : 'ℹ️ Barcodes only store 13 digits. Enter your shop rate once.'
            );
          }
        })
        .catch(() => {
          setIsLookingUp(false);
          setLookupMessage(null);
        });
    }
  };

  const startDetectionLoop = () => {
    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    if (!BarcodeDetectorClass) {
      // Native detector not available, fallback to manual entry or canvas
      return;
    }

    let detector: any;
    try {
      detector = new BarcodeDetectorClass({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
      });
    } catch {
      detector = new BarcodeDetectorClass();
    }

    const scanFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || unseenBarcode) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes && barcodes.length > 0) {
          const first = barcodes[0];
          if (first && first.rawValue) {
            handleBarcodeIdentified(first.rawValue);
          }
        }
      } catch {
        // frame decode error ignored
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeIdentified(manualCode.trim());
    setManualCode('');
  };

  const handleRegisterNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unseenBarcode || !newItemName.trim() || !newItemPrice.trim()) return;

    const price = parseFloat(newItemPrice);
    if (isNaN(price) || price < 0) {
      alert(isHi ? 'कृपया मान्य दर दर्ज करें' : 'Please enter valid price');
      return;
    }

    setIsRegistering(true);
    try {
      const createdItem = await onNewBarcodeRegister({
        barcode: unseenBarcode,
        itemName: newItemName.trim(),
        sellingPrice: price,
        baseUnit: newItemUnit,
      });

      playBeep();
      onItemScanned(createdItem);
      setUnseenBarcode(null);
      setLastScannedCode(null);
    } catch (err: any) {
      alert(err.message || 'Error registering item');
    } finally {
      setIsRegistering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-mk-purple text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BarcodeIcon className="w-6 h-6 text-amber-300" />
            <h2 className="font-bold text-lg">
              {isHi ? 'बारकोड स्कैनर (Barcode Scanner)' : 'Barcode Scanner'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {unseenBarcode ? (
            /* Unseen / New Barcode Registration Form */
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="font-bold text-sm">
                  {isHi ? 'नया बारकोड मिला — तुरंत सामान जोड़ें' : 'New Barcode Found — Add Item'}
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-amber-200 text-xs font-mono font-bold text-slate-700 flex items-center justify-between">
                <div>
                  बारकोड / Barcode: <span className="text-mk-purple text-sm">{unseenBarcode}</span>
                </div>
                {isLookingUp && <Loader2 className="w-4 h-4 text-mk-purple animate-spin" />}
              </div>

              {lookupMessage && (
                <div className="bg-purple-50 text-mk-purple border border-purple-200 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2">
                  {isLookingUp ? <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" /> : null}
                  <span>{lookupMessage}</span>
                </div>
              )}

              <form onSubmit={handleRegisterNewItem} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isHi ? 'सामान का नाम (Item Name) *' : 'Item Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={isHi ? 'उदा. पारले-जी 100g' : 'e.g. Parle-G 100g'}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 font-semibold text-sm focus:border-mk-purple focus:ring-2 focus:ring-purple-100 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isHi ? 'बिक्री दर (Rate ₹) *' : 'Rate (₹) *'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      placeholder="10"
                      className="w-full h-11 px-3 rounded-xl border border-slate-300 font-bold text-sm focus:border-mk-purple focus:ring-2 focus:ring-purple-100 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isHi ? 'इकाई (Unit)' : 'Unit'}
                    </label>
                    <select
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      className="w-full h-11 px-2 rounded-xl border border-slate-300 font-semibold text-sm bg-white focus:border-mk-purple focus:outline-none"
                    >
                      <option value="pc">नग / Piece (pc)</option>
                      <option value="kg">किलो / Kilogram (kg)</option>
                      <option value="l">लीटर / Litre (l)</option>
                      <option value="pack">पैकेट / Pack</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUnseenBarcode(null);
                      setLastScannedCode(null);
                    }}
                    className="flex-1 h-11 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
                  >
                    {isHi ? 'रद्द करें' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isHi ? 'सहेजें व बिल में जोड़ें' : 'Save & Add'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Camera Scanner Viewfinder */}
              <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden flex items-center justify-center border-2 border-slate-700 shadow-inner">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Reticle / Aiming Box Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-4/5 h-1/2 border-2 border-amber-400 rounded-xl relative shadow-lg">
                    {/* Pulsing red scan line */}
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_#ff0000] animate-pulse" />
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/70 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                      {isHi ? 'बारकोड बॉक्स में लाएं' : 'Center barcode in box'}
                    </span>
                  </div>
                </div>

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/90 text-white p-4 flex flex-col items-center justify-center text-center space-y-2">
                    <Camera className="w-10 h-10 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-200">{cameraError}</p>
                  </div>
                )}
              </div>

              {/* Manual Input or USB Scanner Input */}
              <form onSubmit={handleManualSubmit} className="space-y-2">
                <label className="block text-xs font-bold text-mk-muted uppercase tracking-wider">
                  {isHi ? 'हाथ से या USB स्कैनर द्वारा दर्ज करें:' : 'Type code or scan via USB scanner:'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder={isHi ? 'उदा. 8901030383749' : 'e.g. 8901030383749'}
                    className="flex-1 h-12 px-3 rounded-2xl border border-slate-300 font-bold text-base focus:border-mk-purple focus:ring-2 focus:ring-purple-100 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-5 h-12 rounded-2xl bg-mk-purple hover:bg-mk-purple-dark active:bg-purple-900 text-white font-bold text-sm shadow-md shadow-mk-purple/20 flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isHi ? 'जोड़ें' : 'Add'}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

