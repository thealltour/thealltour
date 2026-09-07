import "server-only";

import {
  AVIASALES_AUTOCOMPLETE_URL,
  AVIASALES_TIMEOUT_MS,
  type AviasalesAutocompletePlace,
  type AviasalesClientErrorCode,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesTypes";
import type { AviasalesCacheStore } from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";

async function defaultAviasalesCache(): Promise<AviasalesCacheStore> {
  const mod = await import(
    "@/lib/affiliate/planner/providers/aviasales/aviasalesCacheSupabase"
  );
  return mod.supabaseAviasalesCache;
}

export type AviasalesAutocompleteClientDeps = {
  fetchImpl?: typeof fetch;
  cache?: AviasalesCacheStore;
  timeoutMs?: number;
  baseUrl?: string;
};

type ClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: AviasalesClientErrorCode };

export function isValidIataCode(raw: unknown): raw is string {
  return typeof raw === "string" && /^[A-Za-z]{3}$/.test(raw.trim());
}

export function normalizeIataCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * GET places2 — locale preferred then caller may fall back to en.
 * Skips malformed rows; validates 3-letter IATA codes.
 */
export async function fetchAviasalesAutocomplete(params: {
  term: string;
  locale: string;
  deps?: AviasalesAutocompleteClientDeps;
}): Promise<ClientResult<AviasalesAutocompletePlace[]>> {
  const term = params.term.trim();
  if ([...term].length < 2) {
    return { ok: false, errorCode: "query_too_short" };
  }

  const locale = params.locale.trim() || "en";
  const base = (params.deps?.baseUrl ?? AVIASALES_AUTOCOMPLETE_URL).replace(/\/$/, "");
  const url = new URL(base);
  url.searchParams.set("term", term);
  url.searchParams.set("locale", locale);
  // Request both; ranking prefers city.
  url.searchParams.append("types[]", "city");
  url.searchParams.append("types[]", "airport");

  const controller = new AbortController();
  const timeoutMs = params.deps?.timeoutMs ?? AVIASALES_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchImpl = params.deps?.fetchImpl ?? fetch;
    const res = await fetchImpl(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.info("[aviasales] autocomplete_http_error", {
        providerId: "aviasales",
        operation: "autocomplete",
        errorCode: `http_${res.status}`,
        hostname: "autocomplete.travelpayouts.com",
      });
      return { ok: false, errorCode: "http_error" };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, errorCode: "invalid_response" };
    }
    if (!Array.isArray(json)) {
      return { ok: false, errorCode: "invalid_response" };
    }
    const places: AviasalesAutocompletePlace[] = [];
    for (const row of json) {
      const place = parseAutocompletePlace(row);
      if (place) places.push(place);
    }
    return { ok: true, data: places };
  } catch (error) {
    const code =
      error instanceof Error && error.name === "AbortError" ? "timeout" : "network_failed";
    console.info("[aviasales] autocomplete_failed", {
      providerId: "aviasales",
      operation: "autocomplete",
      errorCode: code,
      hostname: "autocomplete.travelpayouts.com",
    });
    return { ok: false, errorCode: code };
  } finally {
    clearTimeout(timer);
  }
}

export function parseAutocompletePlace(row: unknown): AviasalesAutocompletePlace | null {
  const o = asRecord(row);
  if (!o) return null;
  const typeRaw = typeof o.type === "string" ? o.type.trim().toLowerCase() : "";
  if (typeRaw !== "city" && typeRaw !== "airport") return null;
  if (!isValidIataCode(o.code)) return null;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;

  const countryCode =
    typeof o.country_code === "string" && /^[A-Za-z]{2}$/.test(o.country_code.trim())
      ? o.country_code.trim().toUpperCase()
      : null;

  let cityCode: string | null = null;
  if (isValidIataCode(o.city_code)) {
    cityCode = normalizeIataCode(o.city_code);
  }

  const cityName = typeof o.city_name === "string" ? o.city_name.trim() || null : null;
  const weight =
    typeof o.weight === "number" && Number.isFinite(o.weight) ? o.weight : 0;

  return {
    type: typeRaw,
    code: normalizeIataCode(o.code),
    name,
    countryCode,
    cityCode,
    cityName,
    weight,
  };
}

export async function resolveDefaultAviasalesCache(
  deps?: AviasalesAutocompleteClientDeps,
): Promise<AviasalesCacheStore> {
  return deps?.cache ?? (await defaultAviasalesCache());
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
