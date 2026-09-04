/**
 * STEP R-1: Explicit Korean outbound traveler relevance (not travelRelevanceScore).
 * Deterministic / explainable soft scoring for agenda pool ranking.
 */

import type { ResearchSignalType } from "@/lib/marketing/research/types/enums";
import type { ResearchSourceRoleWeights } from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";

export type KoreanOutboundRelevanceAssessment = {
  score: number;
  reasons: string[];
  demandBand: "high" | "medium" | "low" | "unknown";
};

const HIGH_DEMAND_DESTINATION_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "japan", pattern: /\b(japan|tokyo|osaka|kyoto|hokkaido|okinawa|fukuoka|nagoya|일본|도쿄|오사카|교토|홋카이도|오키나와)\b/i },
  { id: "vietnam", pattern: /\b(vietnam|danang|da\s*nang|nha\s*trang|hanoi|ho\s*chi\s*minh|saigon|베트남|다낭|나트랑|하노이|호치민)\b/i },
  { id: "thailand", pattern: /\b(thailand|bangkok|phuket|chiang\s*mai|pattaya|태국|방콕|푸켓|치앙마이)\b/i },
  { id: "taiwan", pattern: /\b(taiwan|taipei|kaohsiung|대만|타이베이|타이완)\b/i },
  { id: "philippines", pattern: /\b(philippines?|cebu|boracay|manila|필리핀|세부|보라카이|마닐라)\b/i },
  { id: "usa_fit", pattern: /\b(united\s*states|\busa\b|\bu\.s\.|hawaii|guam|saipan|las\s*vegas|new\s*york|grand\s*canyon|california|미국|하와이|괌|사이판|그랜드\s*캐년)\b/i },
  { id: "europe_core", pattern: /\b(spain|barcelona|france|paris|italy|rome|uk|london|croatia|prague|budapest|swiss|switzerland|스페인|프랑스|이탈리아|영국|런던|크로아티아|프라하)\b/i },
  { id: "se_asia_core", pattern: /\b(singapore|hong\s*kong|macau|malaysia|bali|indonesia|싱가포르|홍콩|마카오|말레이시아|발리|인도네시아)\b/i },
  { id: "australia", pattern: /\b(australia|sydney|melbourne|호주|시드니)\b/i },
];

const MEDIUM_DEMAND_DESTINATION_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "nepal", pattern: /\b(nepal|네팔|히말라야|himalaya)\b/i },
  { id: "kenya", pattern: /\b(kenya|케냐|safari|사파리)\b/i },
  { id: "india", pattern: /\b(india|인도(?!\s*네시아))\b/i },
  { id: "turkey", pattern: /\b(turkey|turkiye|istanbul|터키|이스탄불)\b/i },
  { id: "uae", pattern: /\b(dubai|uae|abu\s*dhabi|두바이|아랍에미리트)\b/i },
  { id: "canada", pattern: /\b(canada|vancouver|toronto|캐나다)\b/i },
  { id: "germany", pattern: /\b(germany|munich|berlin|독일|뮌헨|베를린)\b/i },
  { id: "egypt", pattern: /\b(egypt|cairo|이집트)\b/i },
];

const LOW_DEMAND_DESTINATION_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "south_sudan", pattern: /\b(south\s*sudan|남수단)\b/i },
  { id: "sudan", pattern: /\b(?<!south\s)sudan|수단\b/i },
  { id: "sahel", pattern: /\b(chad|niger|mali|burkina|yemen|syria|somalia|중앙아프리카|예멘|시리아|소말리아)\b/i },
];

const PRACTICAL_IMPACT =
  /\b(visa|entry|passport|flight|delay|cancel|typhoon|flood|reopen|advisory|safety|festival|season|hotel|airport|outbreak|quarantine|환승|비자|입국|항공|결항|태풍|축제|성수기|안전)\b/i;

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

  score = clamp01(score);
  return { score, reasons: reasons.slice(0, 8), demandBand: band };
}
