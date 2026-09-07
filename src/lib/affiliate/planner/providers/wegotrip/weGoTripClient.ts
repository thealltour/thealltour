import "server-only";

import {
  WEGOTRIP_API_BASE_URL,
  WEGOTRIP_TIMEOUT_MS,
  type WeGoTripCapabilities,
  type WeGoTripCity,
  type WeGoTripClientErrorCode,
  type WeGoTripProduct,
} from "@/lib/affiliate/planner/providers/wegotrip/weGoTripTypes";
import {
  WEGOTRIP_CAPABILITIES_CACHE_KEY,
  WEGOTRIP_CAPABILITIES_TTL_MS,
  WEGOTRIP_PRODUCTS_TTL_MS,
  weGoTripProductsCacheKey,
  type WeGoTripCacheStore,
} from "@/lib/affiliate/planner/providers/wegotrip/weGoTripCache";

async function defaultWeGoTripCache(): Promise<WeGoTripCacheStore> {
  const mod = await import(
    "@/lib/affiliate/planner/providers/wegotrip/weGoTripCacheSupabase"
  );
  return mod.supabaseWeGoTripCache;
}

export type WeGoTripClientDeps = {
  fetchImpl?: typeof fetch;
  cache?: WeGoTripCacheStore;
  timeoutMs?: number;
  baseUrl?: string;
};

type ClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: WeGoTripClientErrorCode };

export async function fetchWeGoTripJson(
  pathWithQuery: string,
  deps: WeGoTripClientDeps = {},
): Promise<ClientResult<unknown>> {
  const base = (deps.baseUrl ?? WEGOTRIP_API_BASE_URL).replace(/\/$/, "");
  const url = `${base}${pathWithQuery.startsWith("/") ? "" : "/"}${pathWithQuery}`;
  const controller = new AbortController();
  const timeoutMs = deps.timeoutMs ?? WEGOTRIP_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const res = await fetchImpl(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.info("[wegotrip] http_error", {
        providerId: "wegotrip",
        operation: pathWithQuery.split("?")[0] ?? "request",
        errorCode: `http_${res.status}`,
        hostname: "app.wegotrip.com",
      });
      return { ok: false, errorCode: "http_error" };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, errorCode: "invalid_response" };
    }
    return { ok: true, data: json };
  } catch (error) {
    const code =
      error instanceof Error && error.name === "AbortError" ? "timeout" : "network_failed";
    console.info("[wegotrip] request_failed", {
      providerId: "wegotrip",
      operation: pathWithQuery.split("?")[0] ?? "request",
      errorCode: code,
      hostname: "app.wegotrip.com",
    });
    return { ok: false, errorCode: code };
  } finally {
    clearTimeout(timer);
  }
}

export async function searchWeGoTrip(params: {
  query: string;
  deps?: WeGoTripClientDeps;
}): Promise<ClientResult<{ cities: WeGoTripCity[]; rawResults: unknown[] }>> {
  const query = params.query.trim();
  if ([...query].length < 3) {
    return { ok: false, errorCode: "query_too_short" };
  }
  const result = await fetchWeGoTripJson(
    `/search/?query=${encodeURIComponent(query)}`,
    params.deps,
  );
  if (!result.ok) return result;

  const data = asRecord(result.data)?.data;
  const results = asArray(asRecord(data)?.results);
  const cities: WeGoTripCity[] = [];
  for (const row of results) {
    const city = parseSearchCity(row);
    if (city) cities.push(city);
  }
  return { ok: true, data: { cities, rawResults: results } };
}

export async function fetchWeGoTripPopularProducts(params: {
  cityId: number;
  lang: string;
  currency: string;
  deps?: WeGoTripClientDeps;
}): Promise<ClientResult<WeGoTripProduct[]>> {
  const cache = params.deps?.cache ?? (await defaultWeGoTripCache());
  const cacheKey = weGoTripProductsCacheKey({
    cityId: params.cityId,
    lang: params.lang,
    currency: params.currency,
  });
  const fresh = await cache.readFresh<WeGoTripProduct[]>(cacheKey);
  if (fresh && Array.isArray(fresh)) return { ok: true, data: fresh };

  const result = await fetchWeGoTripJson(
    `/products/popular/?lang=${encodeURIComponent(params.lang)}&city=${params.cityId}&currency=${encodeURIComponent(params.currency)}`,
    params.deps,
  );
  if (!result.ok) {
    const stale = await cache.readStale<WeGoTripProduct[]>(cacheKey);
    if (stale && Array.isArray(stale)) return { ok: true, data: stale };
    return result;
  }

  const data = asRecord(result.data)?.data;
  const rows = asArray(asRecord(data)?.results);
  const products: WeGoTripProduct[] = [];
  for (const row of rows) {
    const product = parseProduct(row);
    if (product) products.push(product);
  }
  await cache.write(cacheKey, "products", products, WEGOTRIP_PRODUCTS_TTL_MS);
  return { ok: true, data: products };
}

export async function loadWeGoTripCapabilities(
  deps: WeGoTripClientDeps = {},
): Promise<WeGoTripCapabilities> {
  const cache = deps.cache ?? (await defaultWeGoTripCache());
  const fresh = await cache.readFresh<WeGoTripCapabilities>(WEGOTRIP_CAPABILITIES_CACHE_KEY);
  if (fresh && typeof fresh === "object" && "preferredLang" in fresh) {
    return fresh;
  }

  const languagesResult = await fetchWeGoTripJson("/languages/", deps);
  const currenciesResult = await fetchWeGoTripJson("/currencies/", deps);

  const languages: string[] = [];
  let languagesEndpointOk = false;
  if (languagesResult.ok) {
    languagesEndpointOk = true;
    const payload = asRecord(languagesResult.data)?.data ?? languagesResult.data;
    for (const row of asArray(payload)) {
      const code =
        typeof asRecord(row)?.code === "string"
          ? String(asRecord(row)!.code).toLowerCase()
          : typeof row === "string"
            ? row.toLowerCase()
            : "";
      if (code) languages.push(code);
    }
  }

  const currencies: string[] = [];
  if (currenciesResult.ok) {
    const payload = asRecord(currenciesResult.data)?.data ?? currenciesResult.data;
    for (const row of asArray(payload)) {
      const code =
        typeof asRecord(row)?.code === "string"
          ? String(asRecord(row)!.code).toUpperCase()
          : "";
      if (code) currencies.push(code);
    }
  }

  const preferredLang: "ko" | "en" =
    languagesEndpointOk && languages.includes("ko") ? "ko" : "en";
  const preferredCurrency = currencies.includes("KRW")
    ? "KRW"
    : currencies.includes("USD")
      ? "USD"
      : currencies[0] ?? "USD";

  const caps: WeGoTripCapabilities = {
    languages,
    currencies,
    languagesEndpointOk,
    preferredLang,
    preferredCurrency,
  };
  await cache.write(
    WEGOTRIP_CAPABILITIES_CACHE_KEY,
    "capabilities",
    caps,
    WEGOTRIP_CAPABILITIES_TTL_MS,
  );
  return caps;
}

function parseSearchCity(row: unknown): WeGoTripCity | null {
  const o = asRecord(row);
  if (!o) return null;
  if (o.type !== "city") return null;
  const id = toPositiveInt(o.id);
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const slug = typeof o.slug === "string" ? o.slug.trim() : "";
  if (id == null || !name || !slug) return null;
  const country = asRecord(o.country);
  return {
    id,
    name,
    slug,
    available: o.available !== false,
    countryName: typeof country?.name === "string" ? country.name : null,
  };
}

function parseProduct(row: unknown): WeGoTripProduct | null {
  const o = asRecord(row);
  if (!o) return null;
  const id = toPositiveInt(o.id);
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const slug = typeof o.slug === "string" ? o.slug.trim() : "";
  const cityObj = asRecord(o.city);
  const cityId = toPositiveInt(cityObj?.id);
  const cityName = typeof cityObj?.name === "string" ? cityObj.name.trim() : "";
  const citySlug = typeof cityObj?.slug === "string" ? cityObj.slug.trim() : "";
  if (id == null || !title || !slug || cityId == null || !cityName || !citySlug) return null;

  const tags = asRecord(o.tags);
  const available =
    o.available === false || o.published === false || tags?.available === false
      ? false
      : true;

  return {
    id,
    title,
    slug,
    available,
    rating: typeof o.rating === "number" && Number.isFinite(o.rating) ? o.rating : null,
    reviewsCount:
      typeof o.reviewsCount === "number" && Number.isFinite(o.reviewsCount)
        ? o.reviewsCount
        : null,
    category: typeof o.category === "string" ? o.category : null,
    city: { id: cityId, name: cityName, slug: citySlug },
  };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function toPositiveInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}
