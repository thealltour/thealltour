import type { FlyerWeatherDay } from "@/lib/flyers/weather/flyerWeather.types";
import type { FlyerOutfitDraftState } from "@/lib/flyers/weather/flyerOutfit.types";

/**
 * WeatherAPI 한국어 condition 문자열 등에서 보조 이모지 선택.
 * 과한 장식보다 한 줄 요약·일자 카드의 스캔용 힌트 용도.
 */
export function weatherConditionEmoji(condition: string): string {
  const t = condition.trim();
  if (!t) return "🌤️";
  const lower = t.toLowerCase();
  if (/맑|쾌청|clear|sunny|sun/i.test(t) || /fair/i.test(lower)) return "☀️";
  if (/구름|흐림|cloud|overcast|흐리/i.test(t)) return "☁️";
  if (/천둥|뇌우|thunder|storm/i.test(t)) return "⛈️";
  if (/소나기|shower/i.test(t)) return "🌦️";
  if (/비|이슬비|rain|drizzle|폭우/i.test(t)) return "🌧️";
  if (/눈|sleet|snow/i.test(t)) return "❄️";
  if (/안개|fog|mist|haze/i.test(t)) return "🌫️";
  if (/바람|windy/i.test(t)) return "💨";
  return "🌤️";
}

export function weatherLeadEmojiForDays(days: FlyerWeatherDay[]): string {
  const withCond = days.find((d) => d.condition?.trim());
  if (withCond) return weatherConditionEmoji(withCond.condition);
  const rainy = days.find((d) => (d.chanceOfRain ?? 0) >= 40);
  if (rainy) return "🌦️";
  const hot = days.find((d) => (d.maxC ?? 0) >= 30);
  if (hot) return "☀️";
  return "🌤️";
}

/** 짧은 준비 팁 칩 (복장 체크리스트 + 태그) */
export function weatherPrepChipLabels(outfit: FlyerOutfitDraftState | undefined, max = 6): string[] {
  if (!outfit) return [];
  const fromItems = outfit.items.filter((i) => i.included).map((i) => i.text.trim());
  const tags = (outfit.tags ?? []).map((t) => {
    const m: Record<string, string> = {
      hot: "더위 대비",
      rain: "우산",
      sun: "자외선",
      cold: "보온",
    };
    return m[t] ?? t;
  });
  const merged = [...tags, ...fromItems];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of merged) {
    if (!s || s.length > 20) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export function formatFlyerWeatherDateLabel(isoDate: string): string {
  const t = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(`${t}T12:00:00`);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
}
