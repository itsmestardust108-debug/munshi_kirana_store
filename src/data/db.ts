import Dexie, { type Table } from 'dexie';
import type { MatchableItem } from '../domain/matching';
import type { Customer, CreditCharge, Repayment, PaymentAllocation, LedgerReversal } from '../domain/ledger';
import type { Bill, BillItemSnapshot } from '../domain/billing';

export interface ShopRecord {
  id: string;
  name: string;
  taglineHi?: string;
  taglineEn?: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  isDemo: boolean;
  themeColor: string;
  language: 'hi' | 'en';
  createdAt: string;
  updatedAt: string;
}

export interface InventoryRecord extends MatchableItem {
  shopId: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface AttachmentRecord {
  id: string;
  shopId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  base64Data?: string; // Stored offline in IndexedDB
  remoteStoragePath?: string;
  remoteUrl?: string;
  createdAt: string;
}

export interface InventoryAttachmentJoin {
  id: string;
  inventoryItemId: string;
  attachmentId: string;
  createdAt: string;
}

export interface DraftRecord {
  key: string; // e.g. 'active_bill_draft'
  data: any;
  updatedAt: string;
}

export interface SyncOutboxRecord {
  id: string;
  shopId: string;
  entityType: 'bill' | 'inventory' | 'customer' | 'charge' | 'repayment' | 'reversal' | 'attachment';
  entityId: string;
  operation: 'insert' | 'update' | 'delete';
  payload: any;
  status: 'pending' | 'in_flight' | 'confirmed' | 'failed';
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptShareRecord {
  id: string;
  billId: string;
  token: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  isRevoked: boolean;
}

export class MunsiDatabase extends Dexie {
  shops!: Table<ShopRecord, string>;
  inventory!: Table<InventoryRecord, string>;
  customers!: Table<Customer, string>;
  bills!: Table<Bill, string>;
  credit_charges!: Table<CreditCharge, string>;
  repayments!: Table<Repayment, string>;
  payment_allocations!: Table<PaymentAllocation, string>;
  ledger_reversals!: Table<LedgerReversal, string>;
  attachments!: Table<AttachmentRecord, string>;
  inventory_attachments!: Table<InventoryAttachmentJoin, string>;
  drafts!: Table<DraftRecord, string>;
  sync_outbox!: Table<SyncOutboxRecord, string>;
  receipt_shares!: Table<ReceiptShareRecord, string>;

  constructor() {
    super('MunsiKiranaDB');
    this.version(1).stores({
      shops: 'id, isDemo',
      inventory: 'id, shopId, itemName, variantLabel, hindiName, sellingPrice, isActive, updatedAt, *aliases, *hindiKeywords',
      customers: 'id, shopId, name, phone, isActive, createdAt',
      bills: 'id, shopId, receiptNumber, businessDate, grandTotal, status, operationId, createdAt, syncedAt',
      credit_charges: 'id, shopId, customerId, transactionDate, linkedBillId, isReversed, createdAt',
      repayments: 'id, shopId, customerId, paymentDate, method, idempotentOpId, isReversed, createdAt',
      payment_allocations: 'id, repaymentId, chargeId',
      ledger_reversals: 'id, shopId, targetType, targetId, createdAt',
      attachments: 'id, shopId, createdAt',
      inventory_attachments: 'id, inventoryItemId, attachmentId',
      drafts: 'key, updatedAt',
      sync_outbox: 'id, shopId, entityType, status, createdAt',
      receipt_shares: 'id, billId, token, expiresAt, isRevoked',
    });
  }
}

export const db = new MunsiDatabase();

export const DEMO_SHOP_ID = 'demo-munsi-kirana-001';

export async function seedDemoDataIfEmpty(): Promise<void> {
  const shopCount = await db.shops.count();
  if (shopCount > 0) return;

  const now = new Date().toISOString();

  // 1. Seed Shop
  await db.shops.add({
    id: DEMO_SHOP_ID,
    name: 'मुंशी किराना स्टोर (Munsi Kirana Store)',
    taglineHi: 'परिवार की दुकान — शुद्धता एवं विश्वास',
    taglineEn: 'Family Kirana Store — Purity & Trust',
    ownerName: 'मुंशी जी (Dadaji)',
    phone: '9876500000',
    address: 'मेन बाजार, दुकान नं. 12',
    isDemo: true,
    themeColor: '#5F259F',
    language: 'hi',
    createdAt: now,
    updatedAt: now,
  });

  // 2. Seed Sample Inventory
  const sampleItems: InventoryRecord[] = [
    {
      id: 'inv-sugar-1kg',
      shopId: DEMO_SHOP_ID,
      itemName: 'Sugar',
      hindiName: 'चीनी',
      variantLabel: '1 kg',
      sellingPrice: 60,
      costPrice: 54,
      baseUnit: 'kg',
      aliases: ['chini', 'cheeni', 'shakkar', 'sugar'],
      hindiKeywords: ['चीनी', 'शक्कर', 'साखर', 'sugar'],
      isActive: true,
      notes: 'उत्तम दानेदार चीनी',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'inv-oil-groundnut-1l',
      shopId: DEMO_SHOP_ID,
      itemName: 'Groundnut Oil',
      hindiName: 'मूंगफली का तेल',
      variantLabel: '1 Litre Pouch',
      sellingPrice: 180,
      costPrice: 165,
      baseUnit: 'l',
      aliases: ['mungfali ka tel', 'moongfali oil', 'groundnut oil', 'singtel'],
      hindiKeywords: ['मूंगफली का तेल', 'सिंगतेल', 'तेल'],
      isActive: true,
      notes: 'शुद्ध डबल फिल्टर्ड तेल',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'inv-vim-30',
      shopId: DEMO_SHOP_ID,
      itemName: 'Vim Bar',
      hindiName: 'विम साबुन',
      variantLabel: '₹30 Pack',
      sellingPrice: 30,
      costPrice: 26,
      baseUnit: 'pc',
      aliases: ['vim', 'bartan bar', 'vim bar', 'vim 30'],
      hindiKeywords: ['विम', 'बर्तन साबुन', 'विम बार'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'inv-vim-60',
      shopId: DEMO_SHOP_ID,
      itemName: 'Vim Bar',
      hindiName: 'विम साबुन',
      variantLabel: '₹60 Pack',
      sellingPrice: 60,
      costPrice: 52,
      baseUnit: 'pc',
      aliases: ['vim', 'bartan bar', 'vim bar', 'vim 60'],
      hindiKeywords: ['विम', 'बर्तन साबुन', 'विम बार'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'inv-tea-250g',
      shopId: DEMO_SHOP_ID,
      itemName: 'Tata Tea Gold',
      hindiName: 'टाटा चाय',
      variantLabel: '250g Pack',
      sellingPrice: 140,
      costPrice: 125,
      baseUnit: 'pc',
      aliases: ['chai', 'tea', 'tata tea', 'chai patti'],
      hindiKeywords: ['चाय', 'चाय पत्ती', 'टाटा चाय'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'inv-toor-dal-1kg',
      shopId: DEMO_SHOP_ID,
      itemName: 'Toor Dal',
      hindiName: 'अरहर / तुअर दाल',
      variantLabel: '1 kg',
      sellingPrice: 165,
      costPrice: 150,
      baseUnit: 'kg',
      aliases: ['dal', 'arhar dal', 'toor dal', 'tuar dal'],
      hindiKeywords: ['दाल', 'अरहर दाल', 'तुअर दाल'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'inv-aashirvaad-atta-5kg',
      shopId: DEMO_SHOP_ID,
      itemName: 'Aashirvaad Atta',
      hindiName: 'आशीर्वाद आटा',
      variantLabel: '5 kg Bag',
      sellingPrice: 240,
      costPrice: 220,
      baseUnit: 'pc',
      aliases: ['atta', 'gehu atta', 'flour', 'aashirvaad'],
      hindiKeywords: ['आटा', 'गेहूं का आटा', 'आशीर्वाद'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ];

  await db.inventory.bulkAdd(sampleItems);

  // 3. Seed Sample Customers
  const sampleCustomers: Customer[] = [
    {
      id: 'cust-ramesh',
      shopId: DEMO_SHOP_ID,
      name: 'रमेश कुमार (Ramesh Kumar)',
      phone: '9876543210',
      notes: 'वार्ड 4, मंदिर के पास',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cust-suresh',
      shopId: DEMO_SHOP_ID,
      name: 'सुरेश भाई (Suresh Bhai)',
      phone: '9876543211',
      notes: 'किराना नियमित ग्राहक',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cust-anita',
      shopId: DEMO_SHOP_ID,
      name: 'अनीता शर्मा (Anita Sharma)',
      phone: '9876543212',
      notes: 'स्कूल के सामने',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await db.customers.bulkAdd(sampleCustomers);

  // 4. Seed initial credit entries and repayments for Ramesh to demonstrate Khata
  await db.credit_charges.add({
    id: 'charge-demo-1',
    shopId: DEMO_SHOP_ID,
    customerId: 'cust-ramesh',
    amount: 750,
    transactionDate: '28-10-2026',
    reasonNotes: 'महीने का राशन उधार (Monthly grocery credit)',
    dueDate: '10-11-2026',
    isReversed: false,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  });

  await db.repayments.add({
    id: 'repay-demo-1',
    shopId: DEMO_SHOP_ID,
    customerId: 'cust-ramesh',
    amount: 200,
    paymentDate: '01-11-2026',
    method: 'cash',
    notes: 'नकद भुगतान मिला (Partial payment)',
    idempotentOpId: 'op-repay-demo-1',
    isReversed: false,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  });

  // 5. Seed historical bills to demonstrate Apriori Market Basket suggestions
  // e.g. Sugar + Tea frequently bought together
  const historicalBills: Bill[] = [
    {
      id: 'bill-hist-1',
      shopId: DEMO_SHOP_ID,
      receiptNumber: 'MKS-20261025-001',
      businessDate: '25-10-2026',
      items: [
        {
          id: 'b1-1',
          inventoryItemId: 'inv-sugar-1kg',
          itemName: 'Sugar',
          variantLabel: '1 kg',
          billingUnit: 'kg',
          baseUnit: 'kg',
          defaultSellingPrice: 60,
          ratePerBaseUnit: 60,
          isRateOverridden: false,
          quantity: 2,
          baseQuantity: 2,
          lineTotal: 120,
        },
        {
          id: 'b1-2',
          inventoryItemId: 'inv-tea-250g',
          itemName: 'Tata Tea Gold',
          variantLabel: '250g Pack',
          billingUnit: 'pc',
          baseUnit: 'pc',
          defaultSellingPrice: 140,
          ratePerBaseUnit: 140,
          isRateOverridden: false,
          quantity: 1,
          baseQuantity: 1,
          lineTotal: 140,
        },
      ],
      subtotal: 260,
      discount: 0,
      grandTotal: 260,
      settlement: {
        method: 'cash',
        cashReceived: 260,
        changeReturned: 0,
        upiReceived: 0,
        isOwnerConfirmedUpi: false,
        creditDue: 0,
      },
      status: 'completed',
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      operationId: 'op-b-1',
    },
    {
      id: 'bill-hist-2',
      shopId: DEMO_SHOP_ID,
      receiptNumber: 'MKS-20261026-002',
      businessDate: '26-10-2026',
      items: [
        {
          id: 'b2-1',
          inventoryItemId: 'inv-sugar-1kg',
          itemName: 'Sugar',
          variantLabel: '1 kg',
          billingUnit: 'kg',
          baseUnit: 'kg',
          defaultSellingPrice: 60,
          ratePerBaseUnit: 60,
          isRateOverridden: false,
          quantity: 1,
          baseQuantity: 1,
          lineTotal: 60,
        },
        {
          id: 'b2-2',
          inventoryItemId: 'inv-tea-250g',
          itemName: 'Tata Tea Gold',
          variantLabel: '250g Pack',
          billingUnit: 'pc',
          baseUnit: 'pc',
          defaultSellingPrice: 140,
          ratePerBaseUnit: 140,
          isRateOverridden: false,
          quantity: 1,
          baseQuantity: 1,
          lineTotal: 140,
        },
      ],
      subtotal: 200,
      discount: 0,
      grandTotal: 200,
      settlement: {
        method: 'upi',
        cashReceived: 0,
        changeReturned: 0,
        upiReceived: 200,
        isOwnerConfirmedUpi: true,
        creditDue: 0,
      },
      status: 'completed',
      createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
      operationId: 'op-b-2',
    },
    {
      id: 'bill-hist-3',
      shopId: DEMO_SHOP_ID,
      receiptNumber: 'MKS-20261028-003',
      businessDate: '28-10-2026',
      items: [
        {
          id: 'b3-1',
          inventoryItemId: 'inv-sugar-1kg',
          itemName: 'Sugar',
          variantLabel: '1 kg',
          billingUnit: 'kg',
          baseUnit: 'kg',
          defaultSellingPrice: 60,
          ratePerBaseUnit: 60,
          isRateOverridden: false,
          quantity: 1,
          baseQuantity: 1,
          lineTotal: 60,
        },
        {
          id: 'b3-2',
          inventoryItemId: 'inv-tea-250g',
          itemName: 'Tata Tea Gold',
          variantLabel: '250g Pack',
          billingUnit: 'pc',
          baseUnit: 'pc',
          defaultSellingPrice: 140,
          ratePerBaseUnit: 140,
          isRateOverridden: false,
          quantity: 1,
          baseQuantity: 1,
          lineTotal: 140,
        },
      ],
      subtotal: 200,
      discount: 0,
      grandTotal: 200,
      settlement: {
        method: 'cash',
        cashReceived: 200,
        changeReturned: 0,
        upiReceived: 0,
        isOwnerConfirmedUpi: false,
        creditDue: 0,
      },
      status: 'completed',
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      operationId: 'op-b-3',
    },
    {
      id: 'bill-hist-4',
      shopId: DEMO_SHOP_ID,
      receiptNumber: 'MKS-20261030-004',
      businessDate: '30-10-2026',
      items: [
        {
          id: 'b4-1',
          inventoryItemId: 'inv-sugar-1kg',
          itemName: 'Sugar',
          variantLabel: '1 kg',
          billingUnit: 'kg',
          baseUnit: 'kg',
          defaultSellingPrice: 60,
          ratePerBaseUnit: 60,
          isRateOverridden: false,
          quantity: 3,
          baseQuantity: 3,
          lineTotal: 180,
        },
        {
          id: 'b4-2',
          inventoryItemId: 'inv-tea-250g',
          itemName: 'Tata Tea Gold',
          variantLabel: '250g Pack',
          billingUnit: 'pc',
          baseUnit: 'pc',
          defaultSellingPrice: 140,
          ratePerBaseUnit: 140,
          isRateOverridden: false,
          quantity: 1,
          baseQuantity: 1,
          lineTotal: 140,
        },
        {
          id: 'b4-3',
          inventoryItemId: 'inv-vim-30',
          itemName: 'Vim Bar',
          variantLabel: '₹30 Pack',
          billingUnit: 'pc',
          baseUnit: 'pc',
          defaultSellingPrice: 30,
          ratePerBaseUnit: 30,
          isRateOverridden: false,
          quantity: 2,
          baseQuantity: 2,
          lineTotal: 60,
        },
      ],
      subtotal: 380,
      discount: 0,
      grandTotal: 380,
      settlement: {
        method: 'cash',
        cashReceived: 380,
        changeReturned: 0,
        upiReceived: 0,
        isOwnerConfirmedUpi: false,
        creditDue: 0,
      },
      status: 'completed',
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      operationId: 'op-b-4',
    },
    {
      id: 'bill-hist-5',
      shopId: DEMO_SHOP_ID,
      receiptNumber: 'MKS-20261101-005',
      businessDate: '01-11-2026',
      items: [
        {
          id: 'b5-1',
          inventoryItemId: 'inv-oil-groundnut-1l',
          itemName: 'Groundnut Oil',
          variantLabel: '1 Litre Pouch',
          billingUnit: 'l',
          baseUnit: 'l',
          defaultSellingPrice: 180,
          ratePerBaseUnit: 180,
          isRateOverridden: false,
          quantity: 1,
          baseQuantity: 1,
          lineTotal: 180,
        },
        {
          id: 'b5-2',
          inventoryItemId: 'inv-toor-dal-1kg',
          itemName: 'Toor Dal',
          variantLabel: '1 kg',
          billingUnit: 'kg',
          baseUnit: 'kg',
          defaultSellingPrice: 165,
          ratePerBaseUnit: 165,
          isRateOverridden: false,
          quantity: 1,
          baseQuantity: 1,
          lineTotal: 165,
        },
      ],
      subtotal: 345,
      discount: 0,
      grandTotal: 345,
      settlement: {
        method: 'cash',
        cashReceived: 345,
        changeReturned: 0,
        upiReceived: 0,
        isOwnerConfirmedUpi: false,
        creditDue: 0,
      },
      status: 'completed',
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      operationId: 'op-b-5',
    },
  ];

  await db.bills.bulkAdd(historicalBills);
}
