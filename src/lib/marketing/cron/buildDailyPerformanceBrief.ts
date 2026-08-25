import "server-only";

import { fetchAiFeedbackRows, fetchAiPublicationRows } from "@/lib/marketing/context/sources/analyticsSource";
import {
  fetchAnalyticsEventCount,
  fetchBookingCount,
  fetchInquiryCount,
  fetchThreadMarketingPostCount,
} from "@/lib/marketing/context/sources/metricCountSource";
import { fetchAiMemoryRows } from "@/lib/marketing/context/sources/memorySource";
import { asString } from "@/lib/marketing/context/json";
import { sumFeedbackMetrics } from "@/lib/marketing/context/mappers/performanceMapper";
import {
  computePerformanceDataAvailability,
  previousSeoulDayPeriod,
  type ConfirmedPerformanceMetric,
  type DailyPerformanceBriefArtifact,
  PERFORMANCE_BRIEF_ARTIFACT_VERSION,
  PERFORMANCE_BRIEF_TIMEZONE,
} from "@/lib/marketing/cron/performanceBriefArtifact";

export type BuildDailyPerformanceBriefInput = {
  productId?: string | null;
  channel?: string | null;
  now?: Date;
};

function pushMetric(
  metrics: ConfirmedPerformanceMetric[],
  metricType: string,
  value: number,
  source: string,
): void {
  if (!Number.isFinite(value) || value < 0) return;
  metrics.push({ metricType, value, source });
}

export async function buildDailyPerformanceBrief(
  input: BuildDailyPerformanceBriefInput = {},
): Promise<DailyPerformanceBriefArtifact> {
  const now = input.now ?? new Date();
  const period = previousSeoulDayPeriod(now);
  const productId = input.productId?.trim() || null;
  const channel = input.channel?.trim() || null;

  const sourcesChecked = [
    "ai_publications",
    "ai_feedback",
    "analytics_events",
    "thread_marketing_posts",
    "inquiries",
    "travel_bookings",
    "ai_memory",
  ];

  const missingItems: string[] = [
    "Instagram impressions (no SNS collector)",
    "Threads engagement metrics via official API (no SNS collector)",
    "Channel reach/likes from live SNS login (not used)",
  ];
  const confirmedMetrics: ConfirmedPerformanceMetric[] = [];
  const availableChannels = new Set<string>();
  const managerEvidence: string[] = [];
  const notableChanges: string[] = [];

  const [inquiries, bookings, threadPosts, analyticsEvents, publications, memoryRows] = await Promise.all([
    fetchInquiryCount({
      productId: productId ?? undefined,
      periodStart: period.start,
      periodEnd: period.end,
    }),
    fetchBookingCount({
      productId: productId ?? undefined,
      periodStart: period.start,
      periodEnd: period.end,
    }),
    fetchThreadMarketingPostCount({
      productId: productId ?? undefined,
      periodStart: period.start,
      periodEnd: period.end,
    }),
    fetchAnalyticsEventCount({
      productId: productId ?? undefined,
      periodStart: period.start,
      periodEnd: period.end,
    }),
    fetchAiPublicationRows({
      channel: channel ?? undefined,
      periodStart: period.start,
      periodEnd: period.end,
      limit: 100,
    }),
    fetchAiMemoryRows({
      memoryType: "performance",
      excludeExpired: true,
      limit: 20,
    }),
  ]);

  pushMetric(confirmedMetrics, "inquiries", inquiries, "inquiries");
  pushMetric(confirmedMetrics, "bookings", bookings, "travel_bookings");
  pushMetric(confirmedMetrics, "thread_marketing_posts", threadPosts, "thread_marketing_posts");
  pushMetric(confirmedMetrics, "analytics_events", analyticsEvents, "analytics_events");
  pushMetric(confirmedMetrics, "ai_publications", publications.length, "ai_publications");
  pushMetric(confirmedMetrics, "performance_memory_rows", memoryRows.length, "ai_memory");

  if (inquiries > 0) managerEvidence.push(`inquiries=${inquiries} (DB count, no interpretation)`);
  if (bookings > 0) managerEvidence.push(`bookings=${bookings} (DB count, no interpretation)`);
  if (threadPosts > 0) managerEvidence.push(`thread_marketing_posts=${threadPosts}`);
  if (analyticsEvents > 0) managerEvidence.push(`analytics_events=${analyticsEvents}`);
  if (publications.length > 0) {
    managerEvidence.push(`ai_publications=${publications.length}`);
    for (const row of publications) {
      const ch = asString(row.channel);
      if (ch) availableChannels.add(ch);
    }
  }
  if (threadPosts > 0) availableChannels.add("threads");
  if (memoryRows.length > 0) {
    managerEvidence.push(`ai_memory performance rows=${memoryRows.length} (titles omitted from brief)`);
  }

  const publicationIds = publications
    .map((row) => asString(row.id))
    .filter((id): id is string => Boolean(id));

  const feedback = await fetchAiFeedbackRows({
    channel: channel ?? undefined,
    publicationIds: publicationIds.length > 0 ? publicationIds : undefined,
    periodStart: period.start,
    periodEnd: period.end,
    limit: 500,
  });

  const feedbackMetrics = sumFeedbackMetrics(feedback);
  if (feedbackMetrics.length === 0) {
    missingItems.push("ai_feedback engagement metrics for period");
  } else {
    for (const metric of feedbackMetrics) {
      pushMetric(confirmedMetrics, metric.metricType, metric.value, "ai_feedback");
      managerEvidence.push(`${metric.metricType}=${metric.value} (ai_feedback)`);
    }
    for (const row of feedback) {
      const ch = asString(row.channel);
      if (ch) availableChannels.add(ch);
    }
  }

  const positive = confirmedMetrics.filter(
    (m) => m.value > 0 && m.metricType !== "performance_memory_rows",
  );
  if (positive.length === 0 && feedbackMetrics.length === 0) {
    notableChanges.push("No positive confirmed DB metrics for the period.");
  }

  // SNS collector gaps always leave missingItems non-empty → available becomes partial.
  const dataAvailability =
    positive.length === 0 && feedbackMetrics.length === 0
      ? "unavailable"
      : computePerformanceDataAvailability({
          confirmedMetrics: positive.length > 0 || feedbackMetrics.length > 0 ? confirmedMetrics : [],
          missingItems,
        });

  return {
    version: PERFORMANCE_BRIEF_ARTIFACT_VERSION,
    generatedAt: now.toISOString(),
    timezone: PERFORMANCE_BRIEF_TIMEZONE,
    period,
    productId,
    channel,
    sourcesChecked,
    availableChannels: [...availableChannels].sort(),
    confirmedMetrics,
    missingItems,
    notableChanges,
    managerEvidence,
    dataAvailability,
    snsDirectCollection: false,
  };
}
