import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeForecastRequestRange } from "@/lib/flyers/weather/forecastRange";
import { filterWeatherDaysByRange, parseWeatherApiForecastJson } from "@/lib/flyers/weather/parseWeatherApi";
import { buildWeatherSummary } from "@/lib/flyers/weather/buildWeatherSummary";
import { buildWeatherCacheKey } from "@/lib/flyers/weather/buildWeatherCacheKey";
import type { FlyerWeatherDay } from "@/lib/flyers/weather/flyerWeather.types";

/** 기본 TTL: 6시간 (날씨 변동과 유인물 편집 주기 균형) */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

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
    const summaryText = typeof data.summary_text === "string" ? data.summary_text : "";
    return { days, summaryText };
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
    const summaryText = typeof data.summary_text === "string" ? data.summary_text : "";
    return { days, summaryText };
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
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
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
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "cache_key" },
    );
    if (error) console.error("[weather_cache] upsert failed", error.message);
  } catch (e) {
    console.error("[weather_cache] upsert exception", e);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  const o = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const city = typeof o.city === "string" ? o.city.trim() : "";
  const startDate = typeof o.startDate === "string" ? o.startDate.trim() : "";
  const endDate = typeof o.endDate === "string" ? o.endDate.trim() : "";
  const forceRefresh = o.forceRefresh === true;

  if (!city) {
    return NextResponse.json({ ok: false, message: "도시명을 입력해 주세요." }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ ok: false, message: "출발일과 도착일을 입력해 주세요." }, { status: 400 });
  }

  const range = computeForecastRequestRange(startDate, endDate);
  if (!range.ok) {
    return NextResponse.json({ ok: false, message: range.message }, { status: 400 });
  }

  const cacheKey = buildWeatherCacheKey(city, startDate, endDate);

  if (!forceRefresh) {
    const fresh = await readFreshWeatherCache(cacheKey);
    if (fresh) {
      return NextResponse.json({ ok: true, days: fresh.days, summaryText: fresh.summaryText, cached: true });
    }
  }

  const apiKey = process.env.WEATHER_API_KEY?.trim();
  if (!apiKey) {
    const stale = await readStaleWeatherCache(cacheKey);
    if (stale) {
      return NextResponse.json({
        ok: true,
        days: stale.days,
        summaryText: stale.summaryText,
        staleFallback: true,
      });
    }
    return NextResponse.json(
      { ok: false, message: "WEATHER_API_KEY가 서버에 설정되지 않았습니다." },
      { status: 503 },
    );
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
      return NextResponse.json({
        ok: true,
        days: stale.days,
        summaryText: stale.summaryText,
        staleFallback: true,
      });
    }
    return NextResponse.json(
      { ok: false, message: "날씨 서버에 연결하지 못했습니다." },
      { status: 502 },
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    const stale = await readStaleWeatherCache(cacheKey);
    if (stale) {
      return NextResponse.json({
        ok: true,
        days: stale.days,
        summaryText: stale.summaryText,
        staleFallback: true,
      });
    }
    return NextResponse.json({ ok: false, message: "날씨 응답을 해석할 수 없습니다." }, { status: 502 });
  }

  if (!res.ok) {
    const stale = await readStaleWeatherCache(cacheKey);
    if (stale) {
      return NextResponse.json({
        ok: true,
        days: stale.days,
        summaryText: stale.summaryText,
        staleFallback: true,
      });
    }
    const errObj = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
    const msg =
      typeof errObj.error === "object" && errObj.error !== null
        ? String((errObj.error as Record<string, unknown>).message ?? "조회에 실패했습니다.")
        : "날씨 조회에 실패했습니다.";
    return NextResponse.json({ ok: false, message: msg }, { status: res.status === 401 ? 401 : 400 });
  }

  let days = parseWeatherApiForecastJson(json);
  days = filterWeatherDaysByRange(days, range.filterFrom, range.filterTo);
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

  return NextResponse.json({ ok: true, days, summaryText, cached: false });
}
