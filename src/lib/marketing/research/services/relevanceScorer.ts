import type { ResearchSignalType } from "@/lib/marketing/research/types/enums";
import type { TravelRelevanceAssessment } from "@/lib/marketing/research/types/researchSignal";

const HIGH_TRAVEL_SIGNAL_TYPES = new Set<ResearchSignalType>([
  "visa",
  "policy_change",
  "entry_requirement",
  "flight_route",
  "airfare",
  "festival",
  "event",
  "destination_trend",
  "internal_product",
  "product_opportunity",
  "hotel_resort",
  "golf",
]);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function scoreTravelRelevance(input: {
  signalType: ResearchSignalType;
  destinations: string[];
  topics: string[];
  summary: string;
}): TravelRelevanceAssessment {
  const reasons: string[] = [];
  let score = HIGH_TRAVEL_SIGNAL_TYPES.has(input.signalType) ? 0.65 : 0.35;

  if (input.destinations.length > 0) {
    score += 0.15;
    reasons.push("destination_tags_present");
  }
  if (input.topics.some((t) => /travel|tour|trip|flight|hotel|visa/i.test(t))) {
    score += 0.1;
    reasons.push("travel_topic_keyword");
  }
  if (/travel|tour|trip|destination|airline|visa/i.test(input.summary)) {
    score += 0.05;
    reasons.push("travel_summary_keyword");
  }

  score = clamp01(score);
  return {
    score,
    reasons,
    destinationRelevance: input.destinations.length > 0 ? 0.8 : 0.2,
    travelerImpact: score,
    bookingImpact: ["airfare", "internal_product", "product_opportunity"].includes(input.signalType)
      ? 0.7
      : 0.3,
    marketRelevance: score,
  };
}

export function scorePublicInterest(input: {
  signalType: ResearchSignalType;
  travelRelevanceScore: number;
}): number {
  const base =
    input.signalType === "search_interest" || input.signalType === "destination_trend"
      ? 0.7
      : 0.45;
  return clamp01(base * 0.5 + input.travelRelevanceScore * 0.5);
}
