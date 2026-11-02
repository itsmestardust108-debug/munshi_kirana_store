import Decimal from 'decimal.js';
import { roundPaise, toDecimal, formatINR } from './money';

export interface CalendarDate {
  day: number;
  month: number;
  year: number;
}

export interface InterestPeriodBreakdown {
  periodIndex: number;
  labelHi: string;
  labelEn: string;
  fromDate: string;
  toDate: string;
  openingPrincipal: Decimal;
  interestRateAnnual: Decimal;
  interestAmount: Decimal;
  closingPrincipal: Decimal;
  isResidual: boolean;
  residualMonths?: number;
  residualDays?: number;
}

export interface SingleInterestResult {
  entryId: string;
  label?: string;
  principal: Decimal;
  monthlyRate: Decimal;
  annualRate: Decimal;
  startDate: string;
  endDate: string;
  duration: {
    years: number;
    months: number;
    days: number;
    formattedHi: string;
    formattedEn: string;
  };
  periods: InterestPeriodBreakdown[];
  totalInterest: Decimal;
  finalAmount: Decimal;
  explanationHi: string;
  explanationEn: string;
}

export interface GrandInterestResult {
  entries: SingleInterestResult[];
  combinedPrincipal: Decimal;
  combinedInterest: Decimal;
  grandTotal: Decimal;
  summaryHi: string;
  summaryEn: string;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(month: number, year: number): number {
  switch (month) {
    case 1: return 31;
    case 2: return isLeapYear(year) ? 29 : 28;
    case 3: return 31;
    case 4: return 30;
    case 5: return 31;
    case 6: return 30;
    case 7: return 31;
    case 8: return 31;
    case 9: return 30;
    case 10: return 31;
    case 11: return 30;
    case 12: return 31;
    default: return 30;
  }
}

/**
 * Parses and strictly validates a DD-MM-YYYY date string
 */
export function parseDate(dateStr: string): { valid: boolean; date?: CalendarDate; error?: string } {
  if (!dateStr || typeof dateStr !== 'string') {
    return { valid: false, error: 'तारीख दर्ज करें (Please enter date)' };
  }

  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) {
    return { valid: false, error: 'तारीख का प्रारूप DD-MM-YYYY होना चाहिए' };
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { valid: false, error: 'अमान्य तारीख (Invalid numbers in date)' };
  }

  if (year < 1950 || year > 2150) {
    return { valid: false, error: 'साल 1950 से 2150 के बीच होना चाहिए' };
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: 'महीना 1 से 12 के बीच होना चाहिए' };
  }

  const maxDays = getDaysInMonth(month, year);
  if (day < 1 || day > maxDays) {
    return { valid: false, error: `${month}वें महीने में केवल ${maxDays} दिन होते हैं (Invalid day for month)` };
  }

  return { valid: true, date: { day, month, year } };
}

export function formatDate(d: CalendarDate): string {
  const dd = String(d.day).padStart(2, '0');
  const mm = String(d.month).padStart(2, '0');
  const yyyy = String(d.year);
  return `${dd}-${mm}-${yyyy}`;
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * Converts CalendarDate to UTC midnight timestamp for day counting
 */
function toUtcMidnight(d: CalendarDate): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

/**
 * Returns exact calendar days between date A and date B
 */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  const msA = toUtcMidnight(a);
  const msB = toUtcMidnight(b);
  const diffMs = msB - msA;
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Adds years to a date with leap day clamping (29 Feb -> 28 Feb in non-leap year)
 */
function addYears(d: CalendarDate, yearsToAdd: number): CalendarDate {
  const newYear = d.year + yearsToAdd;
  const maxDay = getDaysInMonth(d.month, newYear);
  return {
    year: newYear,
    month: d.month,
    day: Math.min(d.day, maxDay),
  };
}

/**
 * Adds months to a date with end-of-month clamping
 */
function addMonths(d: CalendarDate, monthsToAdd: number): CalendarDate {
  let newMonth = d.month + monthsToAdd;
  let newYear = d.year;

  while (newMonth > 12) {
    newMonth -= 12;
    newYear += 1;
  }

  const maxDay = getDaysInMonth(newMonth, newYear);
  return {
    year: newYear,
    month: newMonth,
    day: Math.min(d.day, maxDay),
  };
}

/**
 * Calculates exact duration in years, months, and days according to kirana anniversary & clamping rules
 */
export function calculateExactDuration(start: CalendarDate, end: CalendarDate): {
  years: number;
  months: number;
  days: number;
  yearAnchor: CalendarDate;
  monthAnchor: CalendarDate;
} {
  // Step 1: Find largest completed anniversary count
  let years = 0;
  while (true) {
    const nextAnniversary = addYears(start, years + 1);
    if (compareDates(nextAnniversary, end) <= 0) {
      years += 1;
    } else {
      break;
    }
  }

  const yearAnchor = addYears(start, years);

  // Step 2: Find largest completed months count (0..11) from year anchor
  let months = 0;
  while (months < 11) {
    const nextMonth = addMonths(yearAnchor, months + 1);
    if (compareDates(nextMonth, end) <= 0) {
      months += 1;
    } else {
      break;
    }
  }

  const monthAnchor = addMonths(yearAnchor, months);

  // Step 3: Exact remaining calendar days
  const days = daysBetween(monthAnchor, end);

  return { years, months, days, yearAnchor, monthAnchor };
}

/**
 * Authoritative Indian Kirana Monthly Interest Calculator with Annual Compounding
 */
export function calculateSingleInterest(
  entryId: string,
  principalVal: Decimal.Value,
  monthlyRateVal: Decimal.Value,
  startDateStr: string,
  endDateStr: string,
  label?: string
): { success: true; result: SingleInterestResult } | { success: false; error: string } {
  const pCheck = toDecimal(principalVal);
  if (pCheck.isNaN() || pCheck.isNegative()) {
    return { success: false, error: 'अमान्य मूलधन (Invalid principal amount)' };
  }

  const rCheck = toDecimal(monthlyRateVal);
  if (rCheck.isNaN() || rCheck.isNegative()) {
    return { success: false, error: 'अमान्य ब्याज दर (Invalid interest rate)' };
  }

  const startParsed = parseDate(startDateStr);
  if (!startParsed.valid || !startParsed.date) {
    return { success: false, error: startParsed.error || 'अमान्य शुरुआत तारीख' };
  }

  const endParsed = parseDate(endDateStr);
  if (!endParsed.valid || !endParsed.date) {
    return { success: false, error: endParsed.error || 'अमान्य अंतिम तारीख' };
  }

  if (compareDates(startParsed.date, endParsed.date) > 0) {
    return { success: false, error: 'अंतिम तारीख शुरुआत की तारीख से पहले नहीं हो सकती (End date cannot be before start date)' };
  }

  const principal = pCheck;
  const monthlyRate = rCheck;
  const annualRate = monthlyRate.times(12);

  const durationData = calculateExactDuration(startParsed.date, endParsed.date);
  const { years, months, days } = durationData;

  const durationFormattedHi = `${years} वर्ष, ${months} माह, ${days} दिन`;
  const durationFormattedEn = `${years} yrs, ${months} mos, ${days} days`;

  let currentBalance = principal;
  const periods: InterestPeriodBreakdown[] = [];

  // Annual compounding loop
  for (let y = 1; y <= years; y++) {
    const periodStart = addYears(startParsed.date, y - 1);
    const periodEnd = addYears(startParsed.date, y);
    // Annual interest = balance * (R * 12) / 100
    const annualInterest = roundPaise(currentBalance.times(annualRate).dividedBy(100));
    const closing = currentBalance.plus(annualInterest);

    periods.push({
      periodIndex: y,
      labelHi: `वर्ष ${y}`,
      labelEn: `Year ${y}`,
      fromDate: formatDate(periodStart),
      toDate: formatDate(periodEnd),
      openingPrincipal: currentBalance,
      interestRateAnnual: annualRate,
      interestAmount: annualInterest,
      closingPrincipal: closing,
      isResidual: false,
    });

    currentBalance = closing;
  }

  // Residual period calculation (using 30-day month convention: M + D/30)
  if (months > 0 || days > 0) {
    const residualFactor = new Decimal(months).plus(new Decimal(days).dividedBy(30));
    // residualInterest = balance * (monthlyRate / 100) * (M + D/30)
    const residualInterest = roundPaise(
      currentBalance.times(monthlyRate.dividedBy(100)).times(residualFactor)
    );
    const closing = currentBalance.plus(residualInterest);

    periods.push({
      periodIndex: years + 1,
      labelHi: `शेष अवधि (${months} माह, ${days} दिन)`,
      labelEn: `Remaining period (${months} mos, ${days} days)`,
      fromDate: formatDate(durationData.yearAnchor),
      toDate: formatDate(endParsed.date),
      openingPrincipal: currentBalance,
      interestRateAnnual: annualRate,
      interestAmount: residualInterest,
      closingPrincipal: closing,
      isResidual: true,
      residualMonths: months,
      residualDays: days,
    });

    currentBalance = closing;
  }

  const finalAmount = currentBalance;
  const totalInterest = finalAmount.minus(principal);

  // Deterministic bilingual explanation
  const explanationHi = `मूलधन ${formatINR(principal)} पर मासिक ${monthlyRate}% की दर से ${durationFormattedHi} की अवधि में कुल ब्याज ${formatINR(totalInterest)} बना। कुल देय राशि ${formatINR(finalAmount)} है (प्रत्येक पूर्ण वर्ष पर ब्याज मूलधन में जोड़कर वार्षिक चक्रवृद्धित किया गया है)।`;
  const explanationEn = `For principal of ${formatINR(principal)} at ${monthlyRate}% monthly interest over ${durationFormattedEn}, total interest is ${formatINR(totalInterest)}. Final payable amount is ${formatINR(finalAmount)} (interest capitalized annually at completed years).`;

  return {
    success: true,
    result: {
      entryId,
      label,
      principal,
      monthlyRate,
      annualRate,
      startDate: formatDate(startParsed.date),
      endDate: formatDate(endParsed.date),
      duration: {
        years,
        months,
        days,
        formattedHi: durationFormattedHi,
        formattedEn: durationFormattedEn,
      },
      periods,
      totalInterest,
      finalAmount,
      explanationHi,
      explanationEn,
    },
  };
}

/**
 * Calculates Grand Total across multiple loan entries
 */
export function calculateGrandInterest(entries: Array<{
  id: string;
  principal: Decimal.Value;
  monthlyRate: Decimal.Value;
  startDate: string;
  endDate: string;
  label?: string;
}>): { success: true; result: GrandInterestResult } | { success: false; error: string } {
  if (!entries || entries.length === 0) {
    return { success: false, error: 'कम से कम एक प्रविष्टि आवश्यक है (At least one entry required)' };
  }

  const calculatedEntries: SingleInterestResult[] = [];
  let combinedPrincipal = new Decimal(0);
  let combinedInterest = new Decimal(0);
  let grandTotal = new Decimal(0);

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const res = calculateSingleInterest(e.id, e.principal, e.monthlyRate, e.startDate, e.endDate, e.label);
    if (!res.success) {
      return { success: false, error: `प्रविष्टि ${i + 1}: ${res.error}` };
    }
    calculatedEntries.push(res.result);
    combinedPrincipal = combinedPrincipal.plus(res.result.principal);
    combinedInterest = combinedInterest.plus(res.result.totalInterest);
    grandTotal = grandTotal.plus(res.result.finalAmount);
  }

  const count = calculatedEntries.length;
  const summaryHi = `${count} प्रविष्टियों का कुल मूलधन ${formatINR(combinedPrincipal)}, कुल ब्याज ${formatINR(combinedInterest)} तथा महायोग ${formatINR(grandTotal)} है।`;
  const summaryEn = `Grand total for ${count} entries: Combined Principal ${formatINR(combinedPrincipal)}, Total Interest ${formatINR(combinedInterest)}, Total Payable ${formatINR(grandTotal)}.`;

  return {
    success: true,
    result: {
      entries: calculatedEntries,
      combinedPrincipal,
      combinedInterest,
      grandTotal,
      summaryHi,
      summaryEn,
    },
  };
}

/**
 * Formats a typed 8-digit string into DD-MM-YYYY as user types
 */
export function formatTypedDate(rawInput: string): string {
  // Strip non-digits
  const digits = rawInput.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

/**
 * Returns today's date formatted as DD-MM-YYYY in Asia/Kolkata timezone
 */
export function getTodayKolkataDate(): string {
  const now = new Date();
  const kolkataStr = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }); // e.g. "02/11/2026"
  const [day, month, year] = kolkataStr.split('/');
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
}

