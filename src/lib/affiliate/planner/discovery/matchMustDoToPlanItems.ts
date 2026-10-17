import type { PlannerActivityIntent } from "@/lib/affiliate/planner/discovery/types";
import {
  activityNameTokens,
  compactActivityName,
  containsTokenPhrase,
  normalizeActivityName,
} from "@/lib/affiliate/planner/discovery/normalizeActivityName";
import { itemTypeToAffiliateCategory } from "@/lib/affiliate/planner/eligibility";

type PlanDayLike = {
  day: number;
  items: ReadonlyArray<{ order: number; type: string; name: string }>;
};

type CandidateItem = {
  dayNumber: number;
  itemOrder: number;
  name: string;
  compact: string;
  tokens: string[];
};

/** Shorter side must cover at least half of the longer name (blocks "오사카" ⊂ "오사카 야경 크루즈"). */
const MIN_CONTAINMENT_COVERAGE = 0.5;

type NameKey = { compact: string; tokens: string[] };

function isHighContainment(label: NameKey, item: NameKey): boolean {
  const [shorter, longer] =
    label.compact.length <= item.compact.length ? [label, item] : [item, label];
  if (shorter.compact.length < 2) return false;
  if (shorter.compact.length / longer.compact.length < MIN_CONTAINMENT_COVERAGE) return false;
  return containsTokenPhrase(longer.tokens, shorter.tokens);
}

/**
 * Deterministic mustDo → plan item link (attraction/activity items only).
 * 1) spacing-insensitive exact name, 2) whole-token containment with sufficient coverage.
 * Several distinct items at the containment level are ambiguous → unlinked. No fuzzy/LLM matching.
 * Returns one intent per mustDo entry, in input order.
 */
export function matchMustDoToPlanItems(
  mustDo: readonly string[],
  days: readonly PlanDayLike[],
): PlannerActivityIntent[] {
  const candidates: CandidateItem[] = [];
  for (const day of days) {
    const items = [...day.items].sort((a, b) => a.order - b.order);
    for (const item of items) {
      if (itemTypeToAffiliateCategory(item.type) !== "activity") continue;
      const compact = compactActivityName(item.name);
      if (!compact) continue;
      candidates.push({
        dayNumber: day.day,
        itemOrder: item.order,
        name: item.name,
        compact,
        tokens: activityNameTokens(item.name),
      });
    }
  }

  return mustDo.map((rawLabel, requestIndex) => {
    const intent: PlannerActivityIntent = {
      requestIndex,
      rawLabel,
      normalizedLabel: normalizeActivityName(rawLabel),
      dayNumber: null,
      itemOrder: null,
      planItemName: null,
    };
    const label = { compact: compactActivityName(rawLabel), tokens: activityNameTokens(rawLabel) };
    if (!label.compact) return intent;

    const exact = candidates.find((c) => c.compact === label.compact);
    const contained = exact ? [] : candidates.filter((c) => isHighContainment(label, c));
    const distinctContained = new Set(contained.map((c) => c.compact));
    const linked = exact ?? (distinctContained.size === 1 ? contained[0] : undefined);
    if (!linked) return intent;

    return {
      ...intent,
      dayNumber: linked.dayNumber,
      itemOrder: linked.itemOrder,
      planItemName: linked.name,
    };
  });
}
