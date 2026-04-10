import type { FlyerWeatherDay } from "./flyerWeather.types";

export type OutfitChecklistResult = {
  items: string[];
  summaryText: string;
  tags: string[];
};

function pushUnique(out: string[], label: string) {
  const t = label.trim();
  if (!t || out.includes(t)) return;
  out.push(t);
}

/**
 * 날짜별 예보로 rule-based 복장·준비물 문구 생성 (중복 제거).
 * days가 비었거나 온도 데이터가 없으면 최소 기본 항목.
 */
export function buildOutfitChecklist(days: FlyerWeatherDay[]): OutfitChecklistResult {
  if (!days.length) {
    return {
      items: ["편한 복장", "개인 위생용품"],
      summaryText: "날씨 정보가 부족하여 기본 준비물만 안내드립니다.",
      tags: [],
    };
  }

  const mins = days.map((d) => d.minC).filter((n): n is number => n !== null);
  const maxs = days.map((d) => d.maxC).filter((n): n is number => n !== null);
  const maxRain = Math.max(0, ...days.map((d) => d.chanceOfRain ?? 0));

  const minTemp = mins.length > 0 ? Math.min(...mins) : null;
  const maxTemp = maxs.length > 0 ? Math.max(...maxs) : null;

  if (minTemp === null && maxTemp === null) {
    return {
      items: ["편한 복장", "개인 위생용품"],
      summaryText: "기온 데이터가 없어 기본 준비물만 안내드립니다. 우천 시 우산을 준비해 주세요.",
      tags: maxRain >= 30 ? ["rain"] : [],
    };
  }

  const minT = minTemp ?? maxTemp ?? 20;
  const maxT = maxTemp ?? minTemp ?? 20;

  const items: string[] = [];
  const tags: string[] = [];

  if (maxT >= 32) {
    pushUnique(items, "얇은 여름 옷");
    pushUnique(items, "반팔/반바지");
    pushUnique(items, "통풍 좋은 신발");
    tags.push("hot");
  } else if (maxT >= 25) {
    pushUnique(items, "가벼운 여름 옷");
    pushUnique(items, "편한 운동화 또는 샌들");
    tags.push("warm");
  } else if (maxT >= 18) {
    pushUnique(items, "긴팔 또는 얇은 겉옷");
    tags.push("mild");
  } else if (maxT >= 10) {
    pushUnique(items, "가디건 또는 얇은 점퍼");
    tags.push("cool");
  } else {
    pushUnique(items, "두꺼운 외투");
    pushUnique(items, "보온용품");
    tags.push("cold");
  }

  if (maxRain >= 60) {
    pushUnique(items, "우산 또는 우비");
    pushUnique(items, "방수 신발 권장");
    tags.push("rain");
  } else if (maxRain >= 30) {
    pushUnique(items, "접이식 우산");
    tags.push("rain");
  }

  if (maxT >= 28) {
    pushUnique(items, "모자");
    pushUnique(items, "선글라스");
    pushUnique(items, "선크림");
    tags.push("sun");
  }

  if (minT < 10 && maxT >= 20) {
    pushUnique(items, "얇은 겉옷(일교차)");
    tags.push("layer");
  }

  const summaryParts: string[] = [];
  if (maxT >= 28) {
    summaryParts.push("덥고 자외선에 노출될 수 있어 모자·선크림을 권장합니다.");
  } else if (maxT >= 25) {
    summaryParts.push("따뜻한 날씨가 예상됩니다.");
  } else if (maxT < 12) {
    summaryParts.push("기온이 낮을 수 있어 보온에 신경 써 주세요.");
  }

  if (maxRain >= 60) {
    summaryParts.push("강수 가능성이 높아 우산이나 우비 준비를 권장드립니다.");
  } else if (maxRain >= 30) {
    summaryParts.push("일부 날짜에 비 가능성이 있어 우산 준비를 권장드립니다.");
  }

  const summaryText =
    summaryParts.length > 0
      ? summaryParts.join(" ")
      : "현지 날씨에 맞춰 복장과 소지품을 준비해 주세요.";

  const uniqTags = Array.from(new Set(tags));

  return { items, summaryText, tags: uniqTags };
}
