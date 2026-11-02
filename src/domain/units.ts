import Decimal from 'decimal.js';
import { roundPaise, toDecimal } from './money';

export type UnitType = 'kg' | 'g' | 'l' | 'ml' | 'pc' | 'pack' | 'dozen';

export interface UnitDefinition {
  code: UnitType;
  labelEn: string;
  labelHi: string;
  category: 'weight' | 'volume' | 'discrete';
  baseUnit: UnitType;
  multiplierToBase: number; // e.g. 1 g = 0.001 kg, 1 dozen = 12 pcs
}

export const UNITS: Record<UnitType, UnitDefinition> = {
  kg: { code: 'kg', labelEn: 'kg', labelHi: 'किलो', category: 'weight', baseUnit: 'kg', multiplierToBase: 1 },
  g: { code: 'g', labelEn: 'g', labelHi: 'ग्राम', category: 'weight', baseUnit: 'kg', multiplierToBase: 0.001 },
  l: { code: 'l', labelEn: 'litre', labelHi: 'लीटर', category: 'volume', baseUnit: 'l', multiplierToBase: 1 },
  ml: { code: 'ml', labelEn: 'ml', labelHi: 'मिली', category: 'volume', baseUnit: 'l', multiplierToBase: 0.001 },
  pc: { code: 'pc', labelEn: 'piece', labelHi: 'नग', category: 'discrete', baseUnit: 'pc', multiplierToBase: 1 },
  pack: { code: 'pack', labelEn: 'pack', labelHi: 'पैकेट', category: 'discrete', baseUnit: 'pack', multiplierToBase: 1 },
  dozen: { code: 'dozen', labelEn: 'dozen', labelHi: 'दर्जन', category: 'discrete', baseUnit: 'pc', multiplierToBase: 12 },
};

/**
 * Checks if two units are compatible for conversion (e.g. kg and g, or l and ml)
 */
export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const defA = UNITS[unitA as UnitType];
  const defB = UNITS[unitB as UnitType];
  if (!defA || !defB) return unitA === unitB;
  return defA.category === defB.category;
}

/**
 * Gets compatible units for a base unit
 */
export function getCompatibleUnits(baseUnit: string): UnitDefinition[] {
  const def = UNITS[baseUnit as UnitType];
  if (!def) return [UNITS.pc];
  return Object.values(UNITS).filter((u) => u.category === def.category);
}

/**
 * Converts quantity from billing unit into base unit
 * Example: 250 g -> 0.25 kg
 */
export function toBaseQuantity(quantity: Decimal.Value, fromUnit: string, baseUnit: string): Decimal {
  const q = toDecimal(quantity);
  const defFrom = UNITS[fromUnit as UnitType];
  const defBase = UNITS[baseUnit as UnitType];

  if (!defFrom || !defBase || defFrom.category !== defBase.category) {
    return q;
  }

  // Base quantity = quantity * (fromMultiplier / baseMultiplier)
  const ratio = new Decimal(defFrom.multiplierToBase).dividedBy(defBase.multiplierToBase);
  return q.times(ratio);
}

/**
 * Calculates row total given the rate per base unit, quantity, billing unit, and product base unit.
 * Example 1: Rate ₹60/kg, Qty 250 g -> 250g = 0.25 kg -> Total = ₹15.00
 * Example 2: Rate ₹59.50/kg, Qty 2.5 kg -> Total = ₹148.75
 */
export function calculateLineTotal(
  ratePerBaseUnit: Decimal.Value,
  quantity: Decimal.Value,
  billingUnit: string,
  baseUnit: string
): Decimal {
  const baseQty = toBaseQuantity(quantity, billingUnit, baseUnit);
  const lineTotal = toDecimal(ratePerBaseUnit).times(baseQty);
  return roundPaise(lineTotal);
}

