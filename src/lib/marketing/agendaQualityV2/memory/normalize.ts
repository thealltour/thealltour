/**
 * Shared text normalization for Agenda Quality V2 memory fingerprints.
 * Deterministic — no embeddings required.
 */

export function collapseWs(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeKoText(value: string): string {
  return collapseWs(value)
    .toLowerCase()
    .replace(/["""'']/g, "")
    .replace(/[?!.,~…·\-–—:;/\\|()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Synonym / stem folds for topic clustering (deterministic). */
const TOKEN_FOLDS: Array<[RegExp, string]> = [
  [/부모님|부모|가족여행|가족\s*여행|패밀리|가족/, "family"],
  [/크루즈|cruise/, "cruise"],
  [/부산\s*발|부산\s*출발|부산출발|부산/, "busan"],
  [/푸꾸옥|phu\s*quoc|phuquoc/, "phu_quoc"],
  [/발리|bali/, "bali"],
  [/베트남|vietnam/, "vietnam"],
  [/호텔|리조트|resort|숙소/, "lodging"],
  [/항공|직항|노선|flight|airline/, "flight"],
  [/패키지|package/, "package"],
  [/프로모|프로모션|할인|9\.9|세일/, "promo"],
  [/웰니스|웰빙|힐링|eco|에코|생태|에코투어/, "wellness_eco"],
  [/인기|핫한|트렌드|뜬다|반응\s*증가|관심\s*증가/, "popularity"],
  [/공급\s*증가|오픈|개장|신규\s*호텔/, "supply_open"],
];

export function foldTravelTokens(text: string): string[] {
  const norm = normalizeKoText(text);
  const tokens = new Set<string>();
  for (const [re, token] of TOKEN_FOLDS) {
    if (re.test(norm)) tokens.add(token);
  }
  // Keep short latin/number tokens and hangul bigrams sparingly via explicit destinations passed separately
  return [...tokens].sort();
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, (b - a) / (24 * 60 * 60 * 1000));
}

export function stableHash(parts: string[]): string {
  // FNV-1a 32-bit — deterministic, no crypto dependency for pure unit use
  let h = 0x811c9dc5;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
