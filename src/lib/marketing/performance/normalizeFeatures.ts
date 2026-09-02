import type {
  NormalizedPerformanceFeatures,
  PerformanceMetrics,
} from "@/lib/marketing/performance/types";

function safeRate(numerator?: number | null, denominator?: number | null): number | null {
  if (numerator == null || denominator == null) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function computeAgeHoursAtObservation(publishedAt?: string | null, observedAt: string): number | null {
  const publishedMs = Date.parse(publishedAt ?? "");
  const observedMs = Date.parse(observedAt);
  if (!Number.isFinite(publishedMs) || !Number.isFinite(observedMs)) return null;
  const hours = (observedMs - publishedMs) / (60 * 60 * 1000);
  if (!Number.isFinite(hours) || hours < 0) return null;
  return hours;
}

export function deriveNormalizedPerformanceFeatures(
  metrics: PerformanceMetrics,
  publishedAt?: string | null,
  observedAt: string,
): NormalizedPerformanceFeatures {
  const impressions = metrics.impressions ?? metrics.reach ?? metrics.views;
  const denominator = impressions ?? metrics.views;

  return {
    engagementRate: safeRate(
      (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0) + (metrics.saves ?? 0),
      denominator,
    ),
    viewToLikeRate: safeRate(metrics.likes, metrics.views),
    shareRate: safeRate(metrics.shares, denominator),
    saveRate: safeRate(metrics.saves, denominator),
    clickRate: safeRate(metrics.clicks, denominator),
    ageHoursAtObservation: computeAgeHoursAtObservation(publishedAt, observedAt),
  };
}

export function deriveSampleQuality(
  collectionStatus: string,
  ageHours?: number | null,
): string {
  if (collectionStatus !== "success" && collectionStatus !== "partial") {
    return "collection_incomplete";
  }
  if (ageHours != null && ageHours < 6) return "early_observation_lt_6h";
  if (ageHours != null && ageHours < 24) return "single_post_early_sample";
  return "single_post_sample";
}
