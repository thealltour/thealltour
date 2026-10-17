/** Traveler-specified places/activities (Step 4). Shared by schema, normalizer, UI and prompts. */
export const PLANNER_MUST_DO_MAX_ITEMS = 5;
export const PLANNER_MUST_DO_ITEM_MAX_LENGTH = 80;

export const PLANNER_MUST_DO_MAX_ITEMS_MESSAGE = `꼭 가고 싶은 곳·체험은 ${PLANNER_MUST_DO_MAX_ITEMS}개까지 입력해 주세요.`;
export const PLANNER_MUST_DO_ITEM_LENGTH_MESSAGE = `꼭 가고 싶은 곳·체험은 항목당 ${PLANNER_MUST_DO_ITEM_MAX_LENGTH}자 이내로 입력해 주세요.`;

/** Trim, drop empty entries and exact (post-trim) duplicates, keeping first-seen order. */
export function dedupePlannerMustDo(items: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.trim();
    if (!item || out.includes(item)) continue;
    out.push(item);
  }
  return out;
}

/**
 * Step 4 free text → list. Separators: newline and comma.
 * Count/length are not clamped here so step validation can surface them.
 */
export function parsePlannerMustDoText(text: string): string[] {
  return dedupePlannerMustDo(text.split(/[\n,]/));
}

export function formatPlannerMustDoText(items: readonly string[]): string {
  return items.join("\n");
}

/**
 * Defensive restore for stored input_json (legacy / malformed rows).
 * Over-length entries are dropped rather than truncated; at most MAX_ITEMS are kept so a
 * restored session always passes the input schema.
 */
export function normalizeStoredPlannerMustDo(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const strings = raw.filter((item): item is string => typeof item === "string");
  return dedupePlannerMustDo(strings)
    .filter((item) => item.length <= PLANNER_MUST_DO_ITEM_MAX_LENGTH)
    .slice(0, PLANNER_MUST_DO_MAX_ITEMS);
}

function mustDoMatchKey(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s·・.,'’"“”\-_/()[\]{}]+/g, "");
}

/** Counts only (no raw text) — for diagnostics on whether generation reflected mustDo. */
export function countPlannerMustDoCoverage(
  mustDo: readonly string[],
  itemNames: readonly string[],
): { matchedCount: number; unmatchedCount: number } {
  const names = itemNames.map(mustDoMatchKey).filter(Boolean);
  let matchedCount = 0;
  for (const entry of mustDo) {
    const key = mustDoMatchKey(entry);
    if (key && names.some((name) => name.includes(key))) {
      matchedCount += 1;
    }
  }
  return { matchedCount, unmatchedCount: mustDo.length - matchedCount };
}
