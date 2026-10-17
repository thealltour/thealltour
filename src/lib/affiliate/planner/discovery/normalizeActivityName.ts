/**
 * Provider-neutral activity/place name normalization for deterministic matching.
 * NFKC + lowercase; punctuation/symbols (brackets included) become spaces so bracket contents are kept.
 */
export function normalizeActivityName(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function activityNameTokens(raw: string): string[] {
  const normalized = normalizeActivityName(raw);
  return normalized ? normalized.split(" ") : [];
}

/** Spacing-insensitive key ("오사카 성" === "오사카성"). */
export function compactActivityName(raw: string): string {
  return normalizeActivityName(raw).replace(/ /g, "");
}

/** True when `needle` tokens appear as a contiguous run inside `haystack` tokens. */
export function containsTokenPhrase(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) return true;
  }
  return false;
}
