/**
 * Bilingual Hindi/English Search Matching Engine
 */

export interface MatchableItem {
  id: string;
  itemName: string;
  variantLabel?: string;
  hindiName?: string;
  hindiKeywords?: string[];
  aliases?: string[];
  sellingPrice: number | string;
  costPrice?: number | string | null;
  baseUnit: string;
}

export function normalizeSearchText(text: string): string {
  if (!text) return '';
  // Convert Devanagari numerals to Latin numerals
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  let normalized = text.toLowerCase().trim();
  devanagariDigits.forEach((digit, i) => {
    normalized = normalized.replaceAll(digit, String(i));
  });
  // Normalize whitespace
  return normalized.replace(/\s+/g, ' ');
}

export interface MatchResult<T> {
  item: T;
  score: number; // Higher is better match
  matchedField: 'name_prefix' | 'alias_prefix' | 'name_substr' | 'alias_substr' | 'variant';
}

/**
 * Searches a list of matchable items by query (typed or spoken)
 * Supports prefix priority (e.g. "SU" -> Sugar), Hindi aliases ("chini", "mungfali ka tel"),
 * and Devanagari script ("चीनी", "मूंगफली का तेल").
 */
export function searchInventoryItems<T extends MatchableItem>(
  items: T[],
  rawQuery: string,
  limit = 10
): MatchResult<T>[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [];

  const results: MatchResult<T>[] = [];

  for (const item of items) {
    const normName = normalizeSearchText(item.itemName);
    const normHindi = normalizeSearchText(item.hindiName || '');
    const normVariant = normalizeSearchText(item.variantLabel || '');
    const allAliases = [
      ...(item.hindiKeywords || []),
      ...(item.aliases || []),
    ].map(normalizeSearchText);

    let bestScore = 0;
    let bestField: MatchResult<T>['matchedField'] = 'name_substr';

    // 1. Exact match on name or hindi name
    if (normName === query || normHindi === query) {
      bestScore = 100;
      bestField = 'name_prefix';
    }
    // 2. Prefix match on name (e.g. "SU" -> "sugar")
    else if (normName.startsWith(query) || normHindi.startsWith(query)) {
      bestScore = 80;
      bestField = 'name_prefix';
    }
    // 3. Exact match on any alias (e.g. "chini" -> Sugar)
    else if (allAliases.some((a) => a === query)) {
      bestScore = 75;
      bestField = 'alias_prefix';
    }
    // 4. Prefix match on any alias (e.g. "mungfali" -> "mungfali ka tel")
    else if (allAliases.some((a) => a.startsWith(query))) {
      bestScore = 65;
      bestField = 'alias_prefix';
    }
    // 5. Substring match on name or hindi name
    else if (normName.includes(query) || normHindi.includes(query)) {
      bestScore = 50;
      bestField = 'name_substr';
    }
    // 6. Substring match on aliases
    else if (allAliases.some((a) => a.includes(query))) {
      bestScore = 40;
      bestField = 'alias_substr';
    }
    // 7. Substring match on variant (e.g. "30 rs" -> Vim ₹30)
    else if (normVariant.includes(query)) {
      bestScore = 30;
      bestField = 'variant';
    }

    if (bestScore > 0) {
      results.push({ item, score: bestScore, matchedField: bestField });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
