import type { FlyerWeatherDay } from "./flyerWeather.types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/**
 * WeatherAPI forecast.json 응답 → FlyerWeatherDay[]
 * @see https://www.weatherapi.com/docs/
 */
export function parseWeatherApiForecastJson(raw: unknown): FlyerWeatherDay[] {
  if (!isRecord(raw)) return [];
  const forecast = raw.forecast;
  if (!isRecord(forecast)) return [];
  const days = forecast.forecastday;
  if (!Array.isArray(days)) return [];

  const out: FlyerWeatherDay[] = [];
  for (const item of days) {
    if (!isRecord(item)) continue;
    const date = typeof item.date === "string" ? item.date.trim() : "";
    if (!date) continue;
    const day = item.day;
    if (!isRecord(day)) continue;
    const condition = day.condition;
    const text =
      isRecord(condition) && typeof condition.text === "string" ? condition.text.trim() : "";

    out.push({
      date,
      minC: num(day.mintemp_c),
      maxC: num(day.maxtemp_c),
      condition: text,
      chanceOfRain: num(day.daily_chance_of_rain),
    });
  }
  return out;
}

/** filterFrom/filterTo (YYYY-MM-DD, inclusive)에 해당하는 일만 남김 */
export function filterWeatherDaysByRange(
  days: FlyerWeatherDay[],
  filterFrom: string,
  filterTo: string,
): FlyerWeatherDay[] {
  return days.filter((d) => d.date >= filterFrom && d.date <= filterTo);
}
