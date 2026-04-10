import type { FlyerWeatherDay } from "./flyerWeather.types";

function pickLocationName(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "";
  const loc = (raw as Record<string, unknown>).location;
  if (typeof loc !== "object" || loc === null) return "";
  const name = (loc as Record<string, unknown>).name;
  return typeof name === "string" ? name.trim() : "";
}

/**
 * 일별 데이터와 API location(또는 요청 도시명)으로 유인물용 한국어 요약 문장 생성.
 */
export function buildWeatherSummary(
  days: FlyerWeatherDay[],
  options: { cityQuery: string; apiJson?: unknown },
): string {
  const locName = pickLocationName(options.apiJson) || options.cityQuery.trim() || "현지";
  const label = locName;

  if (days.length === 0) {
    return `${label} 기준 예보 데이터를 가져오지 못했습니다. 날씨·복장 안내를 직접 입력해 주세요.`;
  }

  const mins = days.map((d) => d.minC).filter((n): n is number => n !== null);
  const maxs = days.map((d) => d.maxC).filter((n): n is number => n !== null);
  const rains = days.map((d) => d.chanceOfRain).filter((n): n is number => n !== null);

  const minC = mins.length ? Math.min(...mins) : null;
  const maxC = maxs.length ? Math.max(...maxs) : null;
  const maxRain = rains.length ? Math.max(...rains) : 0;

  const tempCore =
    minC !== null && maxC !== null
      ? `예상 기온은 약 ${Math.round(minC)}~${Math.round(maxC)}°C`
      : minC !== null
        ? `예상 최저 기온은 약 ${Math.round(minC)}°C`
        : maxC !== null
          ? `예상 최고 기온은 약 ${Math.round(maxC)}°C`
          : "기온 정보가 제한적";

  let rainSentence = "";
  if (maxRain >= 60) {
    rainSentence = ", 일부 날짜에 비 가능성이 높습니다. 우산·방수 겉옷을 함께 준비해 주세요.";
  } else if (maxRain >= 30) {
    rainSentence = ", 일부 날짜에 비 가능성이 있습니다.";
  } else {
    rainSentence = ", 강수 가능성은 낮은 편입니다.";
  }

  const tail = " 얇은 여름 옷과 자외선 차단 용품을 준비해 주세요.";

  return `${label} 기준 ${tempCore}이며${rainSentence}${tail}`;
}
