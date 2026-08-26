/**
 * 공개 검색 recent keywords — Hero/Header 공유.
 * Legacy Hero key(`hero_recent_searches`)는 최초 1회 merge 후 제거.
 */

export const RECENT_SEARCHES_STORAGE_KEY = "thealltour_recent_searches_v1";
const LEGACY_HERO_RECENT_KEY = "hero_recent_searches";
export const RECENT_SEARCHES_MAX = 10;

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

function dedupeKeepOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const t = item.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** localStorage에서 recent 로드. Hero legacy 키를 한 번 merge한다. */
export function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const current = parseStringArray(window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY));
    const legacy = parseStringArray(window.localStorage.getItem(LEGACY_HERO_RECENT_KEY));
    if (legacy.length === 0) {
      return current.slice(0, RECENT_SEARCHES_MAX);
    }
    const merged = dedupeKeepOrder([...legacy, ...current]).slice(0, RECENT_SEARCHES_MAX);
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(merged));
    window.localStorage.removeItem(LEGACY_HERO_RECENT_KEY);
    return merged;
  } catch {
    return [];
  }
}

export function pushRecentSearch(keyword: string): string[] {
  if (typeof window === "undefined") return [];
  const trimmed = keyword.trim();
  if (!trimmed) return loadRecentSearches();
  try {
    const prev = loadRecentSearches();
    const next = dedupeKeepOrder([trimmed, ...prev]).slice(0, RECENT_SEARCHES_MAX);
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}
