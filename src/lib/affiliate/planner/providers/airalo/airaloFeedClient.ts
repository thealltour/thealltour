import "server-only";

import { parseAiraloFeedXml } from "@/lib/affiliate/planner/providers/airalo/airaloFeedParser";
import {
  AIRALO_CATALOG_CACHE_KEY,
  AIRALO_CATALOG_TTL_MS,
  AIRALO_FEED_MAX_BYTES,
  AIRALO_FEED_TIMEOUT_MS,
  AIRALO_STALE_MEMORY_TTL_MS,
  type AiraloOfferRecord,
} from "@/lib/affiliate/planner/providers/airalo/airaloTypes";
import type { AiraloCatalogCacheStore } from "@/lib/affiliate/planner/providers/airalo/airaloCatalogCache";
import { safeHostnameFromUrl } from "@/lib/affiliate/travelpayouts/urlPolicy";

async function defaultAiraloCache(): Promise<AiraloCatalogCacheStore> {
  const mod = await import(
    "@/lib/affiliate/planner/providers/airalo/airaloCatalogCacheSupabase"
  );
  return mod.supabaseAiraloCatalogCache;
}

export type AiraloFeedClientDeps = {
  feedUrl?: string | null;
  fetchImpl?: typeof fetch;
  cache?: AiraloCatalogCacheStore;
  /**
   * In-process L1 in front of `cache`. Defaults to the module singleton only when `cache` is
   * the default Supabase store; an injected `cache` gets no L1 unless one is passed here.
   */
  memory?: AiraloCatalogMemoryLayer | null;
  timeoutMs?: number;
  now?: () => number;
};

export type AiraloCatalogLoadResult =
  | { ok: true; records: AiraloOfferRecord[]; fromCache: boolean; staleFallback?: boolean }
  | { ok: false; errorCode: string };

/** Process-local catalog copy + the shared cold-refresh promise (single-flight). */
export type AiraloCatalogMemoryLayer = {
  readFresh: (now: number) => AiraloOfferRecord[] | null;
  write: (records: AiraloOfferRecord[], expiresAt: number) => void;
  inflight: Promise<AiraloCatalogLoadResult> | null;
};

export function createAiraloCatalogMemoryLayer(): AiraloCatalogMemoryLayer {
  let entry: { records: AiraloOfferRecord[]; expiresAt: number } | null = null;
  return {
    readFresh(now) {
      if (!entry || entry.expiresAt <= now) return null;
      return entry.records;
    },
    write(records, expiresAt) {
      entry = { records, expiresAt };
    },
    inflight: null,
  };
}

const defaultAiraloCatalogMemory = createAiraloCatalogMemoryLayer();

/**
 * Feed URL source: Travelpayouts account → Airalo program → Tools → New feed download link.
 * Configure as AIRALO_FEED_URL (server-only). Never commit the live URL with tokens if any.
 */
export function getAiraloFeedUrl(override?: string | null): string | null {
  const url = (override ?? process.env.AIRALO_FEED_URL)?.trim() ?? "";
  return url || null;
}

/**
 * Memory (L1) → Supabase fresh (L2) → remote feed → parse → L2 write → L1 write.
 * Concurrent cold misses share one refresh. Stale fallback stays the L2 contract;
 * L1 only holds a stale result briefly so an outage is not re-fetched per request.
 */
export async function loadAiraloCatalog(
  deps: AiraloFeedClientDeps = {},
): Promise<AiraloCatalogLoadResult> {
  const now = deps.now ?? Date.now;
  const memory =
    deps.memory !== undefined ? deps.memory : deps.cache ? null : defaultAiraloCatalogMemory;
  if (!memory) return (await loadFromStoreOrFeed(deps, now)).result;

  const hit = memory.readFresh(now());
  if (hit && hit.length > 0) return { ok: true, records: hit, fromCache: true };
  if (memory.inflight) return memory.inflight;

  const refresh = loadFromStoreOrFeed(deps, now)
    .then(({ result, memoryExpiresAt }) => {
      if (result.ok && memoryExpiresAt != null) memory.write(result.records, memoryExpiresAt);
      return result;
    })
    .finally(() => {
      memory.inflight = null;
    });
  memory.inflight = refresh;
  return refresh;
}

async function loadFromStoreOrFeed(
  deps: AiraloFeedClientDeps,
  now: () => number,
): Promise<{ result: AiraloCatalogLoadResult; memoryExpiresAt: number | null }> {
  const cache = deps.cache ?? (await defaultAiraloCache());
  const fresh = await readFreshWithExpiry(cache, now);
  if (fresh && fresh.records.length > 0) {
    return {
      result: { ok: true, records: fresh.records, fromCache: true },
      memoryExpiresAt: fresh.expiresAt,
    };
  }

  const staleOr = async (
    errorCode: string,
  ): Promise<{ result: AiraloCatalogLoadResult; memoryExpiresAt: number | null }> => {
    const stale = await cache.readStale(AIRALO_CATALOG_CACHE_KEY);
    if (stale && stale.length > 0) {
      return {
        result: { ok: true, records: stale, fromCache: true, staleFallback: true },
        memoryExpiresAt: now() + AIRALO_STALE_MEMORY_TTL_MS,
      };
    }
    return { result: { ok: false, errorCode }, memoryExpiresAt: null };
  };

  const feedUrl = getAiraloFeedUrl(deps.feedUrl);
  if (!feedUrl) return staleOr("config_missing");

  const fetched = await fetchAiraloFeedXml({
    feedUrl,
    fetchImpl: deps.fetchImpl,
    timeoutMs: deps.timeoutMs ?? AIRALO_FEED_TIMEOUT_MS,
  });
  if (!fetched.ok) return staleOr(fetched.errorCode);

  const parsed = parseAiraloFeedXml(fetched.xml);
  if (!parsed.ok) return staleOr(parsed.errorCode);

  await cache.write(AIRALO_CATALOG_CACHE_KEY, parsed.records, AIRALO_CATALOG_TTL_MS);
  return {
    result: { ok: true, records: parsed.records, fromCache: false },
    memoryExpiresAt: now() + AIRALO_CATALOG_TTL_MS,
  };
}

async function readFreshWithExpiry(
  cache: AiraloCatalogCacheStore,
  now: () => number,
): Promise<{ records: AiraloOfferRecord[]; expiresAt: number } | null> {
  if (cache.readFreshEntry) return cache.readFreshEntry(AIRALO_CATALOG_CACHE_KEY);
  const records = await cache.readFresh(AIRALO_CATALOG_CACHE_KEY);
  return records ? { records, expiresAt: now() + AIRALO_CATALOG_TTL_MS } : null;
}

async function fetchAiraloFeedXml(params: {
  feedUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs: number;
}): Promise<{ ok: true; xml: string } | { ok: false; errorCode: string }> {
  const hostname = safeHostnameFromUrl(params.feedUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const fetchImpl = params.fetchImpl ?? fetch;
    const res = await fetchImpl(params.feedUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/xml, text/xml, */*" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.info("[airalo] feed_fetch_failed", {
        providerId: "airalo",
        operation: "feed_fetch",
        errorCode: `http_${res.status}`,
        hostname: hostname ?? undefined,
      });
      return { ok: false, errorCode: `http_${res.status}` };
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > AIRALO_FEED_MAX_BYTES) {
      console.info("[airalo] feed_too_large", {
        providerId: "airalo",
        operation: "feed_fetch",
        errorCode: "payload_too_large",
        hostname: hostname ?? undefined,
      });
      return { ok: false, errorCode: "payload_too_large" };
    }
    const xml = new TextDecoder("utf-8").decode(buf);
    return { ok: true, xml };
  } catch (error) {
    const code =
      error instanceof Error && error.name === "AbortError" ? "timeout" : "network_failed";
    console.info("[airalo] feed_fetch_failed", {
      providerId: "airalo",
      operation: "feed_fetch",
      errorCode: code,
      hostname: hostname ?? undefined,
    });
    return { ok: false, errorCode: code };
  } finally {
    clearTimeout(timer);
  }
}
