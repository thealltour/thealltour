import "server-only";

import { parseAiraloFeedXml } from "@/lib/affiliate/planner/providers/airalo/airaloFeedParser";
import {
  AIRALO_CATALOG_CACHE_KEY,
  AIRALO_FEED_MAX_BYTES,
  AIRALO_FEED_TIMEOUT_MS,
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
  timeoutMs?: number;
  now?: () => number;
};

export type AiraloCatalogLoadResult =
  | { ok: true; records: AiraloOfferRecord[]; fromCache: boolean; staleFallback?: boolean }
  | { ok: false; errorCode: string };

/**
 * Feed URL source: Travelpayouts account → Airalo program → Tools → New feed download link.
 * Configure as AIRALO_FEED_URL (server-only). Never commit the live URL with tokens if any.
 */
export function getAiraloFeedUrl(override?: string | null): string | null {
  const url = (override ?? process.env.AIRALO_FEED_URL)?.trim() ?? "";
  return url || null;
}

export async function loadAiraloCatalog(
  deps: AiraloFeedClientDeps = {},
): Promise<AiraloCatalogLoadResult> {
  const cache = deps.cache ?? (await defaultAiraloCache());
  const fresh = await cache.readFresh(AIRALO_CATALOG_CACHE_KEY);
  if (fresh && fresh.length > 0) {
    return { ok: true, records: fresh, fromCache: true };
  }

  const feedUrl = getAiraloFeedUrl(deps.feedUrl);
  if (!feedUrl) {
    const stale = await cache.readStale(AIRALO_CATALOG_CACHE_KEY);
    if (stale && stale.length > 0) {
      return { ok: true, records: stale, fromCache: true, staleFallback: true };
    }
    return { ok: false, errorCode: "config_missing" };
  }

  const fetched = await fetchAiraloFeedXml({
    feedUrl,
    fetchImpl: deps.fetchImpl,
    timeoutMs: deps.timeoutMs ?? AIRALO_FEED_TIMEOUT_MS,
  });
  if (!fetched.ok) {
    const stale = await cache.readStale(AIRALO_CATALOG_CACHE_KEY);
    if (stale && stale.length > 0) {
      return { ok: true, records: stale, fromCache: true, staleFallback: true };
    }
    return { ok: false, errorCode: fetched.errorCode };
  }

  const parsed = parseAiraloFeedXml(fetched.xml);
  if (!parsed.ok) {
    const stale = await cache.readStale(AIRALO_CATALOG_CACHE_KEY);
    if (stale && stale.length > 0) {
      return { ok: true, records: stale, fromCache: true, staleFallback: true };
    }
    return { ok: false, errorCode: parsed.errorCode };
  }

  await cache.write(AIRALO_CATALOG_CACHE_KEY, parsed.records);
  return { ok: true, records: parsed.records, fromCache: false };
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
