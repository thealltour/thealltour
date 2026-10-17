import "server-only";

import { z } from "zod";
import { isPlannerTiqetsSuggestEnabled } from "@/lib/affiliate/planner/providerConfig";
import { normalizeActivityName } from "@/lib/affiliate/planner/discovery/normalizeActivityName";
import type { EnvBag } from "@/lib/envBag";

/**
 * Travelpayouts widget-generator suggest endpoint (observed, NOT a documented public API).
 * Optional dependency only: every failure resolves to an empty candidate list.
 */
export const TIQETS_SUGGEST_URL = "https://suggest.travelpayouts.com/search";
export const TIQETS_SUGGEST_TIMEOUT_MS = 2_000;
export const TIQETS_SUGGEST_POSITIVE_TTL_MS = 12 * 60 * 60 * 1000;
export const TIQETS_SUGGEST_NEGATIVE_TTL_MS = 30 * 60 * 1000;
export const TIQETS_SUGGEST_ERROR_TTL_MS = 5 * 60 * 1000;
export const TIQETS_SUGGEST_CACHE_MAX_ENTRIES = 500;

export type TiqetsSuggestCandidate = { productId: string; title: string };

export type TiqetsSuggestOutcome = "fetched" | "cache_hit" | "disabled" | "error";

export type TiqetsSuggestResult = {
  candidates: TiqetsSuggestCandidate[];
  outcome: TiqetsSuggestOutcome;
};

type CacheEntry = { candidates: TiqetsSuggestCandidate[]; expiresAt: number };

export type TiqetsSuggestCache = {
  get: (key: string, now: number) => TiqetsSuggestCandidate[] | null;
  set: (key: string, candidates: TiqetsSuggestCandidate[], ttlMs: number, now: number) => void;
  size: () => number;
};

/** Module-local bounded TTL map: expired entries are purged first, then the oldest insert is evicted. */
export function createTiqetsSuggestCache(
  maxEntries: number = TIQETS_SUGGEST_CACHE_MAX_ENTRIES,
): TiqetsSuggestCache {
  const map = new Map<string, CacheEntry>();
  return {
    get(key, now) {
      const hit = map.get(key);
      if (!hit) return null;
      if (hit.expiresAt <= now) {
        map.delete(key);
        return null;
      }
      return hit.candidates;
    },
    set(key, candidates, ttlMs, now) {
      map.delete(key);
      if (map.size >= maxEntries) {
        for (const [k, entry] of map) {
          if (entry.expiresAt <= now) map.delete(k);
        }
      }
      while (map.size >= maxEntries) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
      map.set(key, { candidates, expiresAt: now + ttlMs });
    },
    size: () => map.size,
  };
}

const defaultCache = createTiqetsSuggestCache();

export type TiqetsSuggestClientDeps = {
  fetchImpl?: typeof fetch;
  cache?: TiqetsSuggestCache;
  timeoutMs?: number;
  env?: EnvBag;
  now?: () => number;
};

const suggestRowSchema = z.object({
  title: z.string().trim().min(1).max(300),
  value: z.union([z.string(), z.number()]),
});

function normalizeProductId(value: string | number): string | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  const trimmed = value.trim();
  return /^[1-9]\d{0,11}$/.test(trimmed) ? trimmed : null;
}

/** Non-array → []; rows failing the shape or with a non-numeric product id are skipped. */
export function parseTiqetsSuggestResponse(json: unknown): TiqetsSuggestCandidate[] {
  if (!Array.isArray(json)) return [];
  const out: TiqetsSuggestCandidate[] = [];
  for (const row of json) {
    const parsed = suggestRowSchema.safeParse(row);
    if (!parsed.success) continue;
    const productId = normalizeProductId(parsed.data.value);
    if (!productId) continue;
    out.push({ productId, title: parsed.data.title });
  }
  return out;
}

export function tiqetsSuggestCacheKey(term: string, destinationScope: string): string {
  return `${destinationScope}|${normalizeActivityName(term)}`;
}

function logSuggestFailure(errorCode: string): void {
  console.info("[tiqets] suggest_failed", {
    providerId: "tiqets",
    operation: "suggest",
    errorCode,
    hostname: "suggest.travelpayouts.com",
  });
}

/**
 * One suggest lookup (locale=en). Disabled flag → no fetch. Timeout, HTTP errors, network errors and
 * unexpected payloads → []. Results (including misses and errors) are cached per destination scope.
 */
export async function searchTiqetsSuggest(params: {
  term: string;
  /** Destination identity, e.g. "JP|Osaka"; keeps cache entries destination-scoped. */
  destinationScope: string;
  deps?: TiqetsSuggestClientDeps;
}): Promise<TiqetsSuggestResult> {
  const deps = params.deps ?? {};
  if (!isPlannerTiqetsSuggestEnabled(deps.env)) return { candidates: [], outcome: "disabled" };

  const term = params.term.trim();
  if (!term) return { candidates: [], outcome: "error" };

  const cache = deps.cache ?? defaultCache;
  const now = deps.now ?? Date.now;
  const key = tiqetsSuggestCacheKey(term, params.destinationScope);
  const cached = cache.get(key, now());
  if (cached) return { candidates: cached, outcome: "cache_hit" };

  const url = new URL(TIQETS_SUGGEST_URL);
  url.searchParams.set("service", "tiqets");
  url.searchParams.set("locale", "en");
  url.searchParams.set("term", term);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? TIQETS_SUGGEST_TIMEOUT_MS);
  try {
    const res = await (deps.fetchImpl ?? fetch)(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      logSuggestFailure(`http_${res.status}`);
      cache.set(key, [], TIQETS_SUGGEST_ERROR_TTL_MS, now());
      return { candidates: [], outcome: "error" };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      logSuggestFailure("invalid_response");
      cache.set(key, [], TIQETS_SUGGEST_ERROR_TTL_MS, now());
      return { candidates: [], outcome: "error" };
    }
    const candidates = parseTiqetsSuggestResponse(json);
    cache.set(
      key,
      candidates,
      candidates.length > 0 ? TIQETS_SUGGEST_POSITIVE_TTL_MS : TIQETS_SUGGEST_NEGATIVE_TTL_MS,
      now(),
    );
    return { candidates, outcome: "fetched" };
  } catch (error) {
    logSuggestFailure(
      error instanceof Error && error.name === "AbortError" ? "timeout" : "network_failed",
    );
    cache.set(key, [], TIQETS_SUGGEST_ERROR_TTL_MS, now());
    return { candidates: [], outcome: "error" };
  } finally {
    clearTimeout(timer);
  }
}
