/**
 * STEP R-1: Explicit Korean outbound traveler relevance (not travelRelevanceScore).
 * Deterministic / explainable soft scoring for agenda pool ranking.
 */

import type { ResearchSignalType } from "@/lib/marketing/research/types/enums";
import type { ResearchSourceRoleWeights } from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import {
  classifyTravelDirection,
  type TravelDirection,
} from "@/lib/marketing/research/services/travelDirection";
import {
  hangulCompoundPattern,
  hangulPlacePattern,
} from "@/lib/marketing/research/services/hangulAwareTermMatcher";

export type KoreanOutboundRelevanceAssessment = {
  score: number;
  reasons: string[];
  demandBand: "high" | "medium" | "low" | "unknown";
  travelDirection: TravelDirection;
};

const HIGH_DEMAND_DESTINATION_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: "japan",
    pattern: hangulPlacePattern(
      /\b(japan|tokyo|osaka|kyoto|hokkaido|okinawa|fukuoka|nagoya)\b/i,
      ["일본", "도쿄", "오사카", "교토", "홋카이도", "오키나와", "후쿠오카", "나고야"],
    ),
  },
  {
    id: "vietnam",
    pattern: hangulPlacePattern(
      /\b(vietnam|danang|da\s*nang|nha\s*trang|hanoi|ho\s*chi\s*minh|saigon)\b/i,
      ["베트남", "다낭", "나트랑", "하노이", "호치민"],
    ),
  },
  {
    id: "thailand",
    pattern: hangulPlacePattern(
      /\b(thailand|bangkok|phuket|chiang\s*mai|pattaya)\b/i,
      ["태국", "방콕", "푸켓", "치앙마이"],
    ),
  },
  {
    id: "taiwan",
    pattern: hangulPlacePattern(/\b(taiwan|taipei|kaohsiung)\b/i, [
      { term: "대만", notBefore: "족" },
      "타이베이",
      "타이완",
    ]),
  },
  {
    id: "philippines",
    pattern: hangulPlacePattern(/\b(philippines?|cebu|boracay|manila)\b/i, [
      "필리핀",
      // "세부 사항/내용/일정" = details, not Cebu.
      {
        term: "세부",
        notBefore:
          "\\s*(?:사항|내용|일정|정보|계획|조건|규정|지침|항목|설명|절차|요건|과제|조율|협의|논의|방안|전략|기준|프로그램)",
      },
      "보라카이",
      "마닐라",
    ]),
  },
  {
    id: "usa_fit",
    pattern: hangulPlacePattern(
      /\b(united\s*states|\busa\b|\bu\.s\.|hawaii|guam|saipan|las\s*vegas|new\s*york|grand\s*canyon|california)\b/i,
      ["미국", "하와이", "괌", "사이판", "그랜드 캐년"],
    ),
  },
  {
    id: "europe_core",
    pattern: hangulPlacePattern(
      /\b(spain|barcelona|france|paris|italy|rome|uk|london|croatia|prague|budapest|swiss|switzerland)\b/i,
      ["스페인", "프랑스", "이탈리아", "영국", "런던", "크로아티아", "프라하"],
    ),
  },
  {
    id: "se_asia_core",
    pattern: hangulPlacePattern(
      /\b(singapore|hong\s*kong|macau|malaysia|bali|indonesia)\b/i,
      ["싱가포르", "홍콩", "마카오", "말레이시아", "발리", "인도네시아"],
    ),
  },
  {
    id: "australia",
    pattern: hangulPlacePattern(/\b(australia|sydney|melbourne)\b/i, [
      { term: "호주", notBefore: "머니" },
      "시드니",
    ]),
  },
];

const MEDIUM_DEMAND_DESTINATION_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "nepal", pattern: hangulPlacePattern(/\b(nepal|himalaya)\b/i, ["네팔", "히말라야"]) },
  { id: "kenya", pattern: hangulPlacePattern(/\b(kenya|safari)\b/i, ["케냐", "사파리"]) },
  {
    id: "india",
    pattern: hangulPlacePattern(/\b(india)\b/i, [
      // 인도네시아 (Indonesia), 인도어 (indoor), 인도 받다/되다 (handover) are not India.
      { term: "인도", notBefore: "네시아|어|\\s*(?:받|되|하|요청|절차)", notAfter: "범죄인\\s*" },
    ]),
  },
  {
    id: "turkey",
    pattern: hangulPlacePattern(/\b(turkey|turkiye|istanbul)\b/i, ["터키", "이스탄불"]),
  },
  {
    id: "uae",
    pattern: hangulPlacePattern(/\b(dubai|uae|abu\s*dhabi)\b/i, ["두바이", "아랍에미리트"]),
  },
  { id: "canada", pattern: hangulPlacePattern(/\b(canada|vancouver|toronto)\b/i, ["캐나다"]) },
  {
    id: "germany",
    pattern: hangulPlacePattern(/\b(germany|munich|berlin)\b/i, ["독일", "뮌헨", "베를린"]),
  },
  { id: "egypt", pattern: hangulPlacePattern(/\b(egypt|cairo)\b/i, ["이집트"]) },
];

const LOW_DEMAND_DESTINATION_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "south_sudan", pattern: hangulPlacePattern(/\b(south\s*sudan)\b/i, ["남수단"]) },
  {
    id: "sudan",
    pattern: hangulPlacePattern(/\b(?<!south\s)sudan/i, [
      // 수단 = "means" in 교통 수단 / 결제 수단 / 최후의 수단; glued forms are already
      // excluded by the Hangul left boundary.
      {
        term: "수단",
        notAfter:
          "(?:교통|결제|지불|이동|운송|수송|통신|대체|홍보|생계|투쟁|정책|마케팅|핵심|주요|다양한|새로운|효과적인|중요한|유일한|최후의|하나의)\\s+",
        notBefore: "\\s*(?:과\\s*방법|으로써|을\\s*가리지)",
      },
    ]),
  },
  {
    id: "sahel",
    pattern: hangulPlacePattern(/\b(chad|niger|mali|burkina|yemen|syria|somalia)\b/i, [
      "중앙아프리카",
      "예멘",
      "시리아",
      "소말리아",
    ]),
  },
];

const PRACTICAL_IMPACT = hangulCompoundPattern(
  /\b(visa|entry|passport|flight|delay|cancel|typhoon|flood|reopen|advisory|safety|festival|season|hotel|airport|outbreak|quarantine)\b/i,
  [
    { term: "환승", notBefore: "연애" },
    // 소비자 (consumer), 비자금 (slush fund), 비자발적 (involuntary).
    { term: "비자", notAfter: "소", notBefore: "금|발적" },
    "입국",
    { term: "항공", notBefore: "모함" },
    "결항",
    "태풍",
    "축제",
    "성수기",
    { term: "안전", notBefore: "자산" },
  ],
);

const NICHE_ONLY =
  /\b(ngo|diplomatic|mission|expat\s*compound|mining\s*camp|peacekeeping)\b/i;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeText(parts: string[]): string {
  return parts.filter(Boolean).join(" ").replace(/[_-]+/g, " ").trim();
}

function matchBand(
  text: string,
  patterns: Array<{ id: string; pattern: RegExp }>,
): string | null {
  for (const row of patterns) {
    if (row.pattern.test(text)) return row.id;
  }
  return null;
}

export function detectKoreanOutboundDemandBand(input: {
  title?: string;
  summary?: string;
  destinations?: string[];
  topics?: string[];
}): { band: KoreanOutboundRelevanceAssessment["demandBand"]; matchedId: string | null } {
  const text = normalizeText([
    input.title ?? "",
    input.summary ?? "",
    ...(input.destinations ?? []),
    ...(input.topics ?? []),
  ]);
  if (!text) return { band: "unknown", matchedId: null };

  const high = matchBand(text, HIGH_DEMAND_DESTINATION_PATTERNS);
  if (high) return { band: "high", matchedId: high };
  const medium = matchBand(text, MEDIUM_DEMAND_DESTINATION_PATTERNS);
  if (medium) return { band: "medium", matchedId: medium };
  const low = matchBand(text, LOW_DEMAND_DESTINATION_PATTERNS);
  if (low) return { band: "low", matchedId: low };
  return { band: "unknown", matchedId: null };
}

export function scoreKoreanOutboundRelevance(input: {
  title: string;
  summary: string;
  destinations: string[];
  topics: string[];
  signalTypes?: string[];
  seasonalityScore?: number | null;
  commercialLinkageScore?: number | null;
  matchedProductIds?: string[];
  sourceRole?: Pick<ResearchSourceRoleWeights, "koreanMarketWeight" | "agendaSeedWeight" | "portfolioRole"> | null;
}): KoreanOutboundRelevanceAssessment {
  const reasons: string[] = [];
  const { band, matchedId } = detectKoreanOutboundDemandBand(input);
  let score =
    band === "high" ? 0.72 : band === "medium" ? 0.48 : band === "low" ? 0.12 : 0.32;

  if (matchedId) {
    reasons.push(`destination_demand_${band}:${matchedId}`);
  } else {
    reasons.push("destination_demand_unknown");
  }

  const text = normalizeText([input.title, input.summary, ...input.destinations, ...input.topics]);
  if (PRACTICAL_IMPACT.test(text)) {
    score += band === "low" ? 0.04 : 0.1;
    reasons.push("practical_traveler_impact");
  }

  const signalTypes = (input.signalTypes ?? []).map(String);
  const highImpactSignals = signalTypes.some((t) =>
    ["visa", "entry_requirement", "policy_change", "flight_route", "safety", "disruption", "airfare"].includes(
      t as ResearchSignalType,
    ),
  );
  if (highImpactSignals) {
    score += band === "high" ? 0.08 : band === "medium" ? 0.06 : 0.02;
    reasons.push("planning_affecting_signal");
  }

  if ((input.seasonalityScore ?? 0) >= 0.65) {
    score += 0.05;
    reasons.push("seasonality_support");
  }

  const commercial = input.commercialLinkageScore ?? 0;
  const matchedProducts = input.matchedProductIds?.length ?? 0;
  if (matchedProducts > 0 || commercial >= 0.55) {
    score += 0.08;
    reasons.push("thealltour_product_linkage");
  } else if (commercial >= 0.35) {
    score += 0.03;
    reasons.push("weak_commercial_linkage");
  }

  const koreanMarket = input.sourceRole?.koreanMarketWeight ?? 0.4;
  const seed = input.sourceRole?.agendaSeedWeight ?? 0.5;
  score += (koreanMarket - 0.4) * 0.25;
  score += (seed - 0.5) * 0.12;
  if (koreanMarket >= 0.8) reasons.push("korean_market_source");
  if (seed >= 0.8) reasons.push("strong_agenda_seed_source");
  if (seed <= 0.3) reasons.push("weak_agenda_seed_source");

  if (band === "low") {
    score -= 0.18;
    reasons.push("niche_or_low_demand_destination");
  }
  if (NICHE_ONLY.test(text) && band !== "high") {
    score -= 0.08;
    reasons.push("niche_audience_topic");
  }

  // Globally newsworthy but weak KR outbound (no demand match + safety-only source)
  if (
    band === "low" &&
    (input.sourceRole?.portfolioRole === "safety_verification" || (input.sourceRole?.agendaSeedWeight ?? 1) < 0.35)
  ) {
    score = Math.min(score, 0.18);
    reasons.push("safety_evidence_not_agenda_seed");
  }

  const travelDirection = classifyTravelDirection({
    title: input.title,
    summary: input.summary,
    destinations: input.destinations,
    topics: input.topics,
  });
  reasons.push(`travelDirection_${travelDirection}`);

  // Agenda-seed only: demote non-outbound intents. Do not delete research rows.
  if (travelDirection === "inbound") {
    score = Math.min(score, 0.22) * 0.55;
    reasons.push("inbound_demoted_for_agenda_seed");
  } else if (travelDirection === "domestic") {
    score = Math.min(score, 0.24) * 0.5;
    reasons.push("domestic_demoted_for_agenda_seed");
  } else if (travelDirection === "industry_b2b") {
    score = Math.min(score, 0.26) * 0.55;
    reasons.push("industry_b2b_demoted_for_agenda_seed");
  } else if (travelDirection === "unknown" && band === "unknown") {
    // Korean language / market source alone must not look like outbound proof.
    score = Math.min(score, 0.34);
    reasons.push("unknown_direction_conservative");
  }

  score = clamp01(score);
  return { score, reasons: reasons.slice(0, 10), demandBand: band, travelDirection };
}
