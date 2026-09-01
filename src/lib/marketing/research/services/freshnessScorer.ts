import type { ResearchSignalType } from "@/lib/marketing/research/types/enums";
import type { FreshnessMetadata } from "@/lib/marketing/research/types/researchSignal";

const MS_PER_HOUR = 60 * 60 * 1000;

/** Heuristic half-lives in hours — calibrate in later STEP. */
export const SIGNAL_HALF_LIFE_HOURS: Partial<Record<ResearchSignalType, number>> = {
  disruption: 12,
  safety: 24,
  weather: 24,
  airfare: 48,
  exchange_rate: 48,
  seasonal_condition: 168,
  visa: 720,
  policy_change: 720,
  entry_requirement: 720,
  festival: 336,
  event: 336,
  destination_trend: 168,
  search_interest: 72,
  content_performance: 168,
  internal_product: 2160,
  general_travel_news: 72,
};

export function resolveHalfLifeHours(signalType: ResearchSignalType): number {
  return SIGNAL_HALF_LIFE_HOURS[signalType] ?? 168;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function scoreFreshness(input: {
  signalType: ResearchSignalType;
  publishedAt?: string | null;
  observedAt: string;
  expiresAt?: string | null;
  now?: Date;
}): FreshnessMetadata {
  const now = input.now ?? new Date();
  const observedAt = input.observedAt;
  const expiresAt = input.expiresAt ?? null;
  const halfLifeHours = resolveHalfLifeHours(input.signalType);

  if (expiresAt) {
    const expiry = new Date(expiresAt);
    if (!Number.isNaN(expiry.getTime()) && now.getTime() >= expiry.getTime()) {
      return {
        publishedAt: input.publishedAt ?? null,
        observedAt,
        expiresAt,
        halfLifeHours,
        freshnessScore: 0,
      };
    }
  }

  const anchor = input.publishedAt ?? observedAt;
  const anchorDate = new Date(anchor);
  let freshnessScore = 0.5;
  if (!Number.isNaN(anchorDate.getTime())) {
    const ageHours = (now.getTime() - anchorDate.getTime()) / MS_PER_HOUR;
    if (ageHours <= 0) {
      freshnessScore = 1;
    } else {
      freshnessScore = clamp01(2 ** (-ageHours / halfLifeHours));
    }
  }

  return {
    publishedAt: input.publishedAt ?? null,
    observedAt,
    expiresAt,
    halfLifeHours,
    freshnessScore,
  };
}

export function isStaleFreshness(
  freshness: FreshnessMetadata,
  minScore = 0.15,
  now: Date = new Date(),
): boolean {
  if (freshness.expiresAt) {
    const expiry = new Date(freshness.expiresAt);
    if (!Number.isNaN(expiry.getTime()) && now.getTime() >= expiry.getTime()) {
      return true;
    }
  }
  return (freshness.freshnessScore ?? 0) < minScore;
}
