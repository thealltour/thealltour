/**
 * Performance collection layer: SNS → AI Marketing (read path).
 * No publish/write operations. No live API in STEP 3-1.
 */

import type { SocialChannel, SocialProvider } from "@/lib/marketing/social/domain/providers";

export type DateRange = {
  start: string;
  end: string;
};

export type NormalizedMetric = {
  metricType: string;
  value: number;
  unit?: string | null;
};

export type AccountPerformance = {
  provider: SocialProvider;
  channel: SocialChannel;
  socialAccountId?: string | null;
  period: DateRange;
  metrics: NormalizedMetric[];
  /** available | partial | unavailable — never invent missing SNS metrics */
  dataAvailability: "available" | "partial" | "unavailable";
};

export type PublicationPerformance = {
  provider: SocialProvider;
  channel: SocialChannel;
  externalPostId?: string | null;
  /** Future social_publications.id */
  socialPublicationId?: string | null;
  period: DateRange;
  metrics: NormalizedMetric[];
  dataAvailability: "available" | "partial" | "unavailable";
};

/**
 * Provider-neutral collector port.
 * Implementors must NOT add publish/send/post/delete methods.
 */
export type PerformanceCollector = {
  readonly kind: "performance_collector";
  readonly provider: SocialProvider;
  readonly channel: SocialChannel;
  collectAccountPerformance(input: {
    socialAccountId?: string | null;
    period: DateRange;
  }): Promise<AccountPerformance>;
  collectPublicationPerformance(input: {
    externalPostId?: string | null;
    socialPublicationId?: string | null;
    period: DateRange;
  }): Promise<PublicationPerformance>;
};

export function assertPerformanceCollectorSurface(collector: PerformanceCollector): void {
  if (collector.kind !== "performance_collector") {
    throw new Error("Invalid PerformanceCollector kind");
  }
  const record = collector as PerformanceCollector & Record<string, unknown>;
  for (const forbidden of ["publish", "send", "post", "delete", "archive"]) {
    if (typeof record[forbidden] === "function") {
      throw new Error(`PerformanceCollector must not expose ${forbidden}`);
    }
  }
}
