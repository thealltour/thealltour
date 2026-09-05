import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildWeatherCacheKey } from "@/lib/flyers/weather/buildWeatherCacheKey";
import { computeForecastRequestRange } from "@/lib/flyers/weather/forecastRange";
import { filterWeatherDaysByRange, parseWeatherApiForecastJson } from "@/lib/flyers/weather/parseWeatherApi";
import { buildWeatherSummary } from "@/lib/flyers/weather/buildWeatherSummary";
import type { FlyerWeatherDay } from "@/lib/flyers/weather/flyerWeather.types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FORECAST_HORIZON_DAYS = 14;

function parseCachedDaysJson(raw: unknown): FlyerWeatherDay[] | null {
  if (!Array.isArray(raw)) return null;
  const out: FlyerWeatherDay[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const o = item as Record<string, unknown>;
    const date = typeof o.date === "string" ? o.date.trim() : "";
    if (!date) return null;
    const minC = typeof o.minC === "number" && Number.isFinite(o.minC) ? o.minC : null;
    const maxC = typeof o.maxC === "number" && Number.isFinite(o.maxC) ? o.maxC : null;
    const condition = typeof o.condition === "string" ? o.condition : "";
    const chanceOfRain =
      typeof o.chanceOfRain === "number" && Number.isFinite(o.chanceOfRain) ? o.chanceOfRain : null;
    out.push({ date, minC, maxC, condition, chanceOfRain });
  }
  return out;
}

async function readFreshWeatherCache(
  cacheKey: string,
): Promise<{ days: FlyerWeatherDay[]; summaryText: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("weather_cache")
      .select("parsed_days_json, summary_text")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    const days = parseCachedDaysJson(data.parsed_days_json);
    if (days === null) return null;
    return {
      days,
      summaryText: typeof data.summary_text === "string" ? data.summary_text : "",
    };
  } catch {
    return null;
  }
}

async function readStaleWeatherCache(
  cacheKey: string,
): Promise<{ days: FlyerWeatherDay[]; summaryText: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("weather_cache")
      .select("parsed_days_json, summary_text")
      .eq("cache_key", cacheKey)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const days = parseCachedDaysJson(data.parsed_days_json);
    if (days === null) return null;
    return {
      days,
      summaryText: typeof data.summary_text === "string" ? data.summary_text : "",
    };
  } catch {
    return null;
  }
}

async function saveWeatherCache(params: {
  cacheKey: string;
  city: string;
  startDate: string;
  endDate: string;
  responseJson: unknown;
  days: FlyerWeatherDay[];
  summaryText: string;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("weather_cache").upsert(
      {
        cache_key: params.cacheKey,
        city_query: params.city,
        start_date: params.startDate,
        end_date: params.endDate,
        source: "weatherapi",
        response_json: params.responseJson,
        parsed_days_json: params.days,
        summary_text: params.summaryText,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      },
      { onConflict: "cache_key" },
    );
    if (error) console.error("[weather_cache] upsert failed", error.message);
  } catch (e) {
    console.error("[weather_cache] upsert exception", e);
  }
}

function todayYmdUtc(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const da = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export type CachedWeatherForecastResult =
  | { ok: true; days: FlyerWeatherDay[]; summaryText: string; cached: boolean; staleFallback?: boolean }
  | { ok: false; message: string; code?: "too_early" | "invalid_range" | "provider" };

/**
 * Shared WeatherAPI forecast fetch with weather_cache.
 * Used by admin flyer route and Planner Reality Layer.
 */
export async function fetchCachedWeatherForecast(params: {
  city: string;
  startDate: string;
  endDate: string;
  forceRefresh?: boolean;
}): Promise<CachedWeatherForecastResult> {
  const city = params.city.trim();
  const startDate = params.startDate.trim();
  const endDate = params.endDate.trim();
  if (!city) return { ok: false, message: "도시명을 입력해 주세요.", code: "invalid_range" };

  const range = computeForecastRequestRange(startDate, endDate);
  if (!range.ok) {
    return { ok: false, message: range.message, code: "invalid_range" };
  }

  // Trip starts beyond WeatherAPI forecast horizon → too_early (no fake weather)
  const horizonEnd = addDaysYmd(todayYmdUtc(), FORECAST_HORIZON_DAYS - 1);
  if (range.filterFrom > horizonEnd) {
    return {
      ok: false,
      message: "아직 정확한 일기예보를 확인하기 이른 시기예요.",
      code: "too_early",
    };
  }

  const cacheKey = buildWeatherCacheKey(city, startDate, endDate);

  if (!params.forceRefresh) {
    const fresh = await readFreshWeatherCache(cacheKey);
    if (fresh) {
      return { ok: true, days: fresh.days, summaryText: fresh.summaryText, cached: true };
    }
  }

  const apiKey = process.env.WEATHER_API_KEY?.trim();
  if (!apiKey) {
    const stale = await readStaleWeatherCache(cacheKey);
    if (stale) {
      return {
        ok: true,
        days: stale.days,
        summaryText: stale.summaryText,
        cached: true,
        staleFallback: true,
      };
    }
    return { ok: false, message: "WEATHER_API_KEY가 서버에 설정되지 않았습니다.", code: "provider" };
  }

  const url = new URL("https://api.weatherapi.com/v1/forecast.json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", city);
  url.searchParams.set("days", String(range.apiDays));
  url.searchParams.set("lang", "ko");
  url.searchParams.set("aqi", "no");
  url.searchParams.set("alerts", "no");

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch {
    const stale = await readStaleWeatherCache(cacheKey);
    if (stale) {
      return {
        ok: true,
        days: stale.days,
        summaryText: stale.summaryText,
        cached: true,
        staleFallback: true,
      };
    }
    return { ok: false, message: "날씨 API 요청에 실패했습니다.", code: "provider" };
  }

  if (!res.ok) {
    const stale = await readStaleWeatherCache(cacheKey);
    if (stale) {
      return {
        ok: true,
        days: stale.days,
        summaryText: stale.summaryText,
        cached: true,
        staleFallback: true,
      };
    }
    return { ok: false, message: `날씨 API 오류 (${res.status})`, code: "provider" };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, message: "날씨 응답을 해석할 수 없습니다.", code: "provider" };
  }

  const parsed = parseWeatherApiForecastJson(json);
  const days = filterWeatherDaysByRange(parsed, range.filterFrom, range.filterTo);
  if (days.length === 0) {
    return {
      ok: false,
      message: "아직 정확한 일기예보를 확인하기 이른 시기예요.",
      code: "too_early",
    };
  }

  const summaryText = buildWeatherSummary(days, { cityQuery: city, apiJson: json });
  void saveWeatherCache({
    cacheKey,
    city,
    startDate,
    endDate,
    responseJson: json,
    days,
    summaryText,
  });

  return { ok: true, days, summaryText, cached: false };
}
