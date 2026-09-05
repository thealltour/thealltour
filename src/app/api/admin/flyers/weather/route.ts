import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { fetchCachedWeatherForecast } from "@/lib/flyers/weather/fetchCachedWeatherForecast";

/**
 * Admin flyer weather proxy — orchestration lives in fetchCachedWeatherForecast
 * so Planner can reuse the same cache + WeatherAPI path without admin auth.
 */
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

  const result = await fetchCachedWeatherForecast({
    city,
    startDate,
    endDate,
    forceRefresh,
  });

  if (!result.ok) {
    const status = result.code === "provider" ? 503 : 400;
    return NextResponse.json({ ok: false, message: result.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    days: result.days,
    summaryText: result.summaryText,
    cached: result.cached,
    ...(result.staleFallback ? { staleFallback: true } : {}),
  });
}
