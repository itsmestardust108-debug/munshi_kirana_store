import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, Store, CheckCircle, AlertCircle } from 'lucide-react';
import { db } from '../../data/db';
import type { Bill } from '../../domain/billing';
import { formatINR } from '../../domain/money';
import { fetchRemotePublicReceipt } from '../../integrations/syncEngine';

export const PublicReceiptScreen: React.FC = () => {
  const { shareToken, id } = useParams<{ shareToken?: string; id?: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReceipt() {
      setIsLoading(false);
      try {
        let foundBill: Bill | undefined;

        if (shareToken) {
          // 1. Try remote cloud projection first (for customers on any phone)
          const remote = await fetchRemotePublicReceipt(shareToken);
          if (remote) {
            foundBill = {
              id: remote.receiptNumber,
              shopId: 'remote',
              receiptNumber: remote.receiptNumber,
              businessDate: remote.businessDate,
              items: remote.items.map((it: any, idx: number) => ({
                id: `line-${idx}`,
                itemName: it.itemName,
                variantLabel: it.variantLabel,
                billingUnit: it.billingUnit,
                baseUnit: it.billingUnit,
                defaultSellingPrice: Number(it.rate),
                ratePerBaseUnit: Number(it.rate),
                isRateOverridden: false,
                quantity: Number(it.quantity),
                baseQuantity: Number(it.quantity),
                lineTotal: Number(it.lineTotal),
              })),
              subtotal: Number(remote.subtotal),
              discount: Number(remote.discount || 0),
              grandTotal: Number(remote.grandTotal),
              settlement: {
                method: remote.settlement?.method || 'cash',
                cashReceived: Number(remote.settlement?.cashReceived || 0),
                changeReturned: 0,
                upiReceived: Number(remote.settlement?.upiReceived || 0),
                isOwnerConfirmedUpi: false,
                creditDue: Number(remote.settlement?.creditDue || 0),
              },
              status: remote.status,
              createdAt: new Date().toISOString(),
              operationId: remote.receiptNumber,
            };
          } else {
            // 2. Check local device's receipt_shares (verifying expiry and revocation)
            const share = await db.receipt_shares.where('token').equals(shareToken).first();
            if (share) {
              const isExpired = new Date(share.expiresAt).getTime() <= Date.now();
              if (!share.isRevoked && !isExpired) {
                foundBill = await db.bills.get(share.billId);
              }
            }
          }
        } else if (id) {
          foundBill = await db.bills.get(id);
        }

        if (foundBill) {
          setBill(foundBill);
        } else {
          setError('यह बिल रसीद उपलब्ध नहीं है या लिंक समाप्त हो चुका है');
        }
      } catch (err: any) {
        setError('बिल लोड करने में त्रुटि');
      }
    }
    fetchReceipt();
  }, [shareToken, id]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <p className="text-sm font-bold text-slate-500">रसीद लोड हो रही है...</p>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-6 rounded-3xl border border-red-200 text-center space-y-3 shadow-lg">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">रसीद उपलब्ध नहीं है</h2>
          <p className="text-xs text-slate-500">{error || 'कृपया दुकान से संपर्क करें'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 font-devanagari">
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-mk-purple text-white p-6 text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-[#FFF0D6] border-2 border-amber-300 text-mk-purple mx-auto flex items-center justify-center font-black text-2xl shadow">
            मुं
          </div>
          <h1 className="text-2xl font-black tracking-tight">मुंशी किराना स्टोर</h1>
          <p className="text-xs text-purple-200 font-medium">
            परिवार की दुकान — शुद्धता एवं विश्वास • मेन बाजार
          </p>
        </div>

        {/* Receipt Meta */}
        <div className="p-6 space-y-5">
          <div className="flex justify-between items-center text-xs text-slate-600 pb-3 border-b border-dashed border-slate-200">
            <div>
              <span className="block font-bold text-slate-800">
                रसीद संख्या: #{bill.receiptNumber}
              </span>
              <span>तारीख: {bill.businessDate}</span>
            </div>
            {bill.settlement.customerName && (
              <div className="text-right">
                <span className="block font-bold text-slate-800">ग्राहक:</span>
                <span>{bill.settlement.customerName}</span>
              </div>
            )}
          </div>

          {/* Itemized Table */}
          <div className="space-y-3">
            <div className="grid grid-cols-12 text-xs font-bold text-slate-400 uppercase tracking-wider pb-1">
              <span className="col-span-6">सामान</span>
              <span className="col-span-3 text-center">मात्रा</span>
              <span className="col-span-3 text-right">कुल ₹</span>
            </div>

            <div className="space-y-2.5 divide-y divide-slate-100">
              {bill.items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 text-sm pt-2 items-center">
                  <div className="col-span-6 pr-1">
                    <span className="font-extrabold text-slate-900 block leading-tight">
                      {item.itemName}
                    </span>
                    <span className="text-xs text-slate-500">
                      @ ₹{item.ratePerBaseUnit}/{item.billingUnit}
                    </span>
                  </div>
                  <div className="col-span-3 text-center text-xs font-bold text-slate-700">
                    {item.quantity} {item.billingUnit}
                  </div>
                  <div className="col-span-3 text-right font-black text-slate-900">
                    {formatINR(item.lineTotal)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Breakdown */}
          <div className="pt-4 border-t-2 border-slate-900 space-y-1.5 text-sm">
            {bill.discount > 0 && (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>उप-कुल (Subtotal):</span>
                  <span>{formatINR(bill.subtotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>छूट (Discount):</span>
                  <span>-{formatINR(bill.discount)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between text-xl font-black text-slate-900 pt-1">
              <span>महायोग (Grand Total):</span>
              <span>{formatINR(bill.grandTotal)}</span>
            </div>

            {/* Payment Summary */}
            <div className="pt-3 border-t border-dashed border-slate-200 text-xs space-y-1">
              {bill.settlement.cashReceived > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>नकद भुगतान प्राप्त:</span>
                  <span className="font-bold">{formatINR(bill.settlement.cashReceived)}</span>
                </div>
              )}
              {bill.settlement.upiReceived > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>UPI भुगतान प्राप्त:</span>
                  <span className="font-bold">{formatINR(bill.settlement.upiReceived)}</span>
                </div>
              )}
              {bill.settlement.creditDue > 0 && (
                <div className="flex justify-between text-amber-800 font-extrabold">
                  <span>खाते में बाकी उधार:</span>
                  <span>{formatINR(bill.settlement.creditDue)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Thank You Note */}
          <div className="text-center pt-4 text-xs text-slate-500 space-y-1">
            <p className="font-bold text-slate-700">खरीदारी के लिए धन्यवाद! 🙏</p>
            <p>फिर पधारिएगा • शुद्धता एवं विश्वास का प्रतीक</p>
          </div>

          {/* Print Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handlePrint}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>प्रिंट / PDF सेव करें</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

