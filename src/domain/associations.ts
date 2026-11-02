/**
 * Market Basket Analysis & Association Rules Engine (Apriori Pair Mining)
 * Computes Support, Confidence, and Lift for grocery item co-purchases
 */

export interface BasketBill {
  id: string;
  status: 'completed' | 'voided' | 'corrected';
  itemIds: string[]; // Set of distinct inventoryItemIds in this basket
}

export interface AssociationSuggestion {
  targetItemId: string;
  targetItemName: string;
  targetVariantLabel?: string;
  defaultSellingPrice: number;
  baseUnit: string;
  support: number;
  confidence: number;
  lift: number;
  category: 'association' | 'popular' | 'recent';
}

/**
 * Computes suggested items given currently selected items in the active bill
 */
export function getBasketSuggestions(
  activeItemIds: string[],
  historicalBills: BasketBill[],
  inventoryLookup: Map<
    string,
    {
      id: string;
      itemName: string;
      variantLabel?: string;
      sellingPrice: number;
      baseUnit: string;
      isActive: boolean;
    }
  >,
  limit = 3
): AssociationSuggestion[] {
  // Filter only completed, valid bills
  const completedBills = historicalBills.filter(
    (b) => b.status === 'completed' && b.itemIds.length > 0
  );
  const totalBaskets = completedBills.length;

  const activeSet = new Set(activeItemIds);

  // If active basket is empty or very few total baskets, return popular items
  if (totalBaskets < 5 || activeItemIds.length === 0) {
    return getPopularFallback(completedBills, activeSet, inventoryLookup, limit);
  }

  // Count frequencies of individual items and pairs
  const itemCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>(); // key: `${activeId}:${candidateId}`

  for (const bill of completedBills) {
    const uniqueItemsInBill = Array.from(new Set(bill.itemIds));

    // Count individual presence
    for (const item of uniqueItemsInBill) {
      itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
    }

    // Count pairs where one is in activeSet and the other is NOT in activeSet
    for (const act of activeItemIds) {
      if (!uniqueItemsInBill.includes(act)) continue;

      for (const cand of uniqueItemsInBill) {
        if (activeSet.has(cand)) continue; // Don't suggest item already in active basket

        const pairKey = `${act}:${cand}`;
        pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
      }
    }
  }

  // Calculate association rules: A -> B
  interface ScoredCandidate {
    candidateId: string;
    support: number;
    confidence: number;
    lift: number;
    jointCount: number;
  }

  const candidateScores = new Map<string, ScoredCandidate>();

  for (const [pairKey, jointCount] of pairCounts.entries()) {
    const [actId, candId] = pairKey.split(':');
    const actCount = itemCounts.get(actId) || 0;
    const candCount = itemCounts.get(candId) || 0;

    if (actCount === 0 || candCount === 0) continue;

    // Minimum evidence rule: at least 3 joint baskets
    if (jointCount < 3) continue;

    const support = jointCount / totalBaskets;
    const confidence = jointCount / actCount;
    const expectedSupport = (actCount / totalBaskets) * (candCount / totalBaskets);
    const lift = expectedSupport > 0 ? support / expectedSupport : 1;

    // If candidate already scored from another active item, take the highest lift/confidence
    const existing = candidateScores.get(candId);
    if (!existing || confidence > existing.confidence) {
      candidateScores.set(candId, {
        candidateId: candId,
        support,
        confidence,
        lift,
        jointCount,
      });
    }
  }

  const results: AssociationSuggestion[] = [];

  // Sort by lift * confidence descending
  const sortedCandidates = Array.from(candidateScores.values()).sort(
    (a, b) => b.lift * b.confidence - a.lift * a.confidence
  );

  for (const sc of sortedCandidates) {
    const inv = inventoryLookup.get(sc.candidateId);
    if (!inv || !inv.isActive) continue;

    results.push({
      targetItemId: inv.id,
      targetItemName: inv.itemName,
      targetVariantLabel: inv.variantLabel,
      defaultSellingPrice: inv.sellingPrice,
      baseUnit: inv.baseUnit,
      support: Number(sc.support.toFixed(3)),
      confidence: Number(sc.confidence.toFixed(3)),
      lift: Number(sc.lift.toFixed(2)),
      category: 'association',
    });

    if (results.length >= limit) break;
  }

  // If not enough association suggestions, pad with popular items
  if (results.length < limit) {
    const popularPads = getPopularFallback(
      completedBills,
      new Set([...activeSet, ...results.map((r) => r.targetItemId)]),
      inventoryLookup,
      limit - results.length
    );
    results.push(...popularPads);
  }

  return results;
}

function getPopularFallback(
  completedBills: BasketBill[],
  excludeIds: Set<string>,
  inventoryLookup: Map<
    string,
    {
      id: string;
      itemName: string;
      variantLabel?: string;
      sellingPrice: number;
      baseUnit: string;
      isActive: boolean;
    }
  >,
  limit: number
): AssociationSuggestion[] {
  const counts = new Map<string, number>();

  for (const b of completedBills) {
    for (const id of b.itemIds) {
      if (!excludeIds.has(id)) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const suggestions: AssociationSuggestion[] = [];

  for (const [id, count] of sorted) {
    const inv = inventoryLookup.get(id);
    if (!inv || !inv.isActive) continue;

    suggestions.push({
      targetItemId: inv.id,
      targetItemName: inv.itemName,
      targetVariantLabel: inv.variantLabel,
      defaultSellingPrice: inv.sellingPrice,
      baseUnit: inv.baseUnit,
      support: count,
      confidence: 0,
      lift: 1,
      category: 'popular',
    });

    if (suggestions.length >= limit) break;
  }

  // If still empty (e.g. brand new store with no history), pick any active inventory items
  if (suggestions.length < limit) {
    for (const inv of inventoryLookup.values()) {
      if (!excludeIds.has(inv.id) && inv.isActive) {
        suggestions.push({
          targetItemId: inv.id,
          targetItemName: inv.itemName,
          targetVariantLabel: inv.variantLabel,
          defaultSellingPrice: inv.sellingPrice,
          baseUnit: inv.baseUnit,
          support: 0,
          confidence: 0,
          lift: 1,
          category: 'popular',
        });
        if (suggestions.length >= limit) break;
      }
    }
  }

  return suggestions;
}
