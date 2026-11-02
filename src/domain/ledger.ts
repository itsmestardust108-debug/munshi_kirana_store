import Decimal from 'decimal.js';
import { roundPaise, toDecimal } from './money';
import { parseDate, compareDates, getTodayKolkataDate } from './interest';

export interface Customer {
  id: string;
  shopId: string;
  name: string;
  phone?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCharge {
  id: string;
  shopId: string;
  customerId: string;
  amount: number | string; // in INR
  transactionDate: string; // DD-MM-YYYY
  reasonNotes?: string;
  linkedBillId?: string;
  dueDate?: string; // DD-MM-YYYY
  isReversed?: boolean;
  createdAt: string;
}

export interface Repayment {
  id: string;
  shopId: string;
  customerId: string;
  amount: number | string; // in INR
  paymentDate: string; // DD-MM-YYYY
  method: 'cash' | 'upi';
  notes?: string;
  idempotentOpId?: string;
  isReversed?: boolean;
  createdAt: string;
}

export interface PaymentAllocation {
  id: string;
  shopId: string;
  repaymentId: string;
  chargeId: string;
  allocatedAmount: number | string;
}

export interface LedgerReversal {
  id: string;
  shopId: string;
  targetType: 'charge' | 'repayment';
  targetId: string;
  reason: string;
  createdAt: string;
}

export interface LedgerStatementEntry {
  id: string;
  type: 'charge' | 'repayment' | 'reversal';
  date: string;
  description: string;
  debit: Decimal; // Increases customer debt
  credit: Decimal; // Decreases customer debt
  runningBalance: Decimal;
  linkedBillId?: string;
  isReversed: boolean;
}

export interface CustomerLedgerSummary {
  customerId: string;
  customerName: string;
  phone?: string;
  totalCharges: Decimal;
  totalRepayments: Decimal;
  outstandingBalance: Decimal;
  advanceCredit: Decimal; // When payments exceed charges
  isOverdue: boolean;
  lastActivityDate?: string;
  statement: LedgerStatementEntry[];
}

/**
 * Deterministically derives a customer's current balance and running chronological statement
 */
export function buildCustomerLedgerSummary(
  customer: Customer,
  charges: CreditCharge[],
  repayments: Repayment[],
  reversals: LedgerReversal[]
): CustomerLedgerSummary {
  const reversedChargeIds = new Set(
    reversals.filter((r) => r.targetType === 'charge').map((r) => r.targetId)
  );
  const reversedRepaymentIds = new Set(
    reversals.filter((r) => r.targetType === 'repayment').map((r) => r.targetId)
  );

  // Combine entries into a unified timeline
  interface RawEntry {
    id: string;
    type: 'charge' | 'repayment';
    date: string;
    amount: Decimal;
    desc: string;
    linkedBillId?: string;
    isReversed: boolean;
    createdAt: string;
    dueDate?: string;
  }

  const rawEntries: RawEntry[] = [];

  for (const c of charges) {
    if (c.customerId !== customer.id) continue;
    const isRev = Boolean(c.isReversed || reversedChargeIds.has(c.id));
    rawEntries.push({
      id: c.id,
      type: 'charge',
      date: c.transactionDate,
      amount: toDecimal(c.amount),
      desc: c.reasonNotes || (c.linkedBillId ? 'बिल उधार (Bill Credit)' : 'उधार (Credit)'),
      linkedBillId: c.linkedBillId,
      isReversed: isRev,
      createdAt: c.createdAt,
      dueDate: c.dueDate,
    });
  }

  for (const r of repayments) {
    if (r.customerId !== customer.id) continue;
    const isRev = Boolean(r.isReversed || reversedRepaymentIds.has(r.id));
    rawEntries.push({
      id: r.id,
      type: 'repayment',
      date: r.paymentDate,
      amount: toDecimal(r.amount),
      desc: `${r.method.toUpperCase()} भुगतान मिला ${r.notes ? `(${r.notes})` : ''}`,
      isReversed: isRev,
      createdAt: r.createdAt,
    });
  }

  // Sort chronologically by date, then createdAt
  rawEntries.sort((a, b) => {
    const pA = parseDate(a.date);
    const pB = parseDate(b.date);
    if (pA.valid && pB.valid && pA.date && pB.date) {
      const cmp = compareDates(pA.date, pB.date);
      if (cmp !== 0) return cmp;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });

  let running = new Decimal(0);
  let totalCharges = new Decimal(0);
  let totalRepayments = new Decimal(0);
  const statement: LedgerStatementEntry[] = [];

  for (const item of rawEntries) {
    let debit = new Decimal(0);
    let credit = new Decimal(0);

    if (item.type === 'charge') {
      debit = item.amount;
      if (!item.isReversed) {
        totalCharges = totalCharges.plus(item.amount);
        running = running.plus(item.amount);
      }
    } else {
      credit = item.amount;
      if (!item.isReversed) {
        totalRepayments = totalRepayments.plus(item.amount);
        running = running.minus(item.amount);
      }
    }

    statement.push({
      id: item.id,
      type: item.type,
      date: item.date,
      description: item.isReversed ? `[रद्द / Voided] ${item.desc}` : item.desc,
      debit: roundPaise(debit),
      credit: roundPaise(credit),
      runningBalance: roundPaise(running),
      linkedBillId: item.linkedBillId,
      isReversed: item.isReversed,
    });
  }

  const outstanding = roundPaise(running);
  const finalOutstanding = outstanding.greaterThan(0) ? outstanding : new Decimal(0);
  const advance = outstanding.isNegative() ? roundPaise(outstanding.abs()) : new Decimal(0);

  // Check overdue
  const todayStr = getTodayKolkataDate();
  const todayParsed = parseDate(todayStr);
  let isOverdue = false;

  if (finalOutstanding.greaterThan(0) && todayParsed.valid && todayParsed.date) {
    for (const c of rawEntries) {
      if (c.type === 'charge' && !c.isReversed && c.dueDate) {
        const dueParsed = parseDate(c.dueDate);
        if (dueParsed.valid && dueParsed.date && compareDates(dueParsed.date, todayParsed.date) < 0) {
          isOverdue = true;
          break;
        }
      }
    }
  }

  const lastActivity = statement.length > 0 ? statement[statement.length - 1].date : undefined;

  return {
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    totalCharges: roundPaise(totalCharges),
    totalRepayments: roundPaise(totalRepayments),
    outstandingBalance: finalOutstanding,
    advanceCredit: advance,
    isOverdue,
    lastActivityDate: lastActivity,
    statement,
  };
}

/**
 * Allocates a repayment against outstanding charges (FIFO / oldest-first by default)
 */
export function allocateRepayment(
  repaymentAmount: Decimal.Value,
  activeCharges: CreditCharge[],
  specificChargeId?: string
): {
  allocations: Array<{ chargeId: string; amount: Decimal }>;
  unallocatedAmount: Decimal;
} {
  let remaining = roundPaise(repaymentAmount);
  const allocations: Array<{ chargeId: string; amount: Decimal }> = [];

  // Filter out reversed charges
  let queue = activeCharges.filter((c) => !c.isReversed && toDecimal(c.amount).greaterThan(0));

  // If specific charge selected, bring it to front
  if (specificChargeId) {
    const specific = queue.find((c) => c.id === specificChargeId);
    if (specific) {
      queue = [specific, ...queue.filter((c) => c.id !== specificChargeId)];
    }
  }

  for (const charge of queue) {
    if (remaining.lessThanOrEqualTo(0)) break;

    const chargeAmt = toDecimal(charge.amount);
    const alloc = Decimal.min(remaining, chargeAmt);

    allocations.push({
      chargeId: charge.id,
      amount: roundPaise(alloc),
    });

    remaining = remaining.minus(alloc);
  }

  return {
    allocations,
    unallocatedAmount: roundPaise(remaining),
  };
}
