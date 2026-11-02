import Decimal from 'decimal.js';

// Configure Decimal defaults
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(value: Decimal.Value): Decimal {
  if (value instanceof Decimal) return value;
  try {
    return new Decimal(value || 0);
  } catch {
    return new Decimal(0);
  }
}

/**
 * Rounds an amount to nearest paise (2 decimal places) using standard HALF_UP rule
 */
export function roundPaise(amount: Decimal.Value): Decimal {
  return toDecimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Returns integer paise (e.g. 148.75 -> 14875)
 */
export function toPaise(amount: Decimal.Value): number {
  return roundPaise(amount).times(100).toNumber();
}

/**
 * Formats a number/Decimal into INR currency format: ₹1,48,750.50 or ₹50.00
 */
export function formatINR(amount: Decimal.Value, includeSymbol = true): string {
  const d = roundPaise(amount);
  const isNegative = d.isNegative();
  const absVal = d.abs();
  const [intPart, decPart] = absVal.toFixed(2).split('.');

  // Format integer part with Indian comma numbering: 12,34,567
  let lastThree = intPart.slice(-3);
  const otherNumbers = intPart.slice(0, -3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  const result = `${isNegative ? '-' : ''}${formattedInt}.${decPart}`;

  return includeSymbol ? `₹${result}` : result;
}

/**
 * Validates bounded non-negative money amount
 */
export function validateAmount(amount: Decimal.Value, max = 100_000_000): { valid: boolean; error?: string } {
  try {
    const d = toDecimal(amount);
    if (d.isNaN() || !d.isFinite()) {
      return { valid: false, error: 'अमान्य राशि (Invalid amount)' };
    }
    if (d.isNegative()) {
      return { valid: false, error: 'राशि शून्य से कम नहीं हो सकती (Amount cannot be negative)' };
    }
    if (d.greaterThan(max)) {
      return { valid: false, error: 'राशि अधिकतम सीमा से अधिक है (Amount exceeds limit)' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'अमान्य राशि (Invalid amount)' };
  }
}
