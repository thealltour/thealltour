import type { AiFeedbackRow } from "@/lib/marketing/context/mappers/performanceMapper";
import {
  hasMetricType,
  mapPerformanceSummary,
  mergeMetricsWithoutDuplicate,
  sumFeedbackMetrics,
  topPublicationIdsByMetric,
} from "@/lib/marketing/context/mappers/performanceMapper";
import type { MetricSummary, PerformanceSummary } from "@/lib/marketing/context/types";
import {
  PERFORMANCE_MEMORY_CONFIDENCE_HIGH,
  PERFORMANCE_MEMORY_CONFIDENCE_LOW,
  PERFORMANCE_MEMORY_CONFIDENCE_MID,
  PERFORMANCE_MEMORY_EXPIRES_DAYS,
  PERFORMANCE_MEMORY_IMPORTANCE_HIGH,
  PERFORMANCE_MEMORY_IMPORTANCE_LOW,
  PERFORMANCE_MEMORY_IMPORTANCE_MID,
  PERFORMANCE_MEMORY_MAX_TOP_CONTENT,
  PERFORMANCE_MEMORY_SOURCE_TYPE,
  PERFORMANCE_MEMORY_TYPE,
} from "@/lib/marketing/memory/constants";
import { normalizeMemoryText } from "@/lib/marketing/memory/normalization";
import type { MemoryDocument } from "@/lib/marketing/memory/types";

export type PerformanceMemoryWindow = {
  key: string;
  lookbackDays: number;
  explicitRange: boolean;
  period: { start: string; end: string };
};

export type PerformanceMemoryMappingInput = {
  productId: string;
  productTitle?: string | null;
  channel: string | null;
  window: PerformanceMemoryWindow;
  publicationCount: number;
  threadPostCount: number;
  inquiryCount: number;
  bookingCount: number;
  analyticsEventCount: number;
  feedback: AiFeedbackRow[];
  publicationContentIds: Record<string, string>;
  contentTitles: Record<string, string>;
};

const ENGAGEMENT_ORDER = [
  "views",
  "impressions",
  "reach",
  "likes",
  "comments",
  "replies",
  "shares",
  "reposts",
  "saves",
  "clicks",
] as const;

const CONVERSION_TYPES = new Set([
  "inquiries",
  "inquiry_count",
  "bookings",
  "booking_count",
  "conversions",
  "revenue",
]);

const METRIC_LABELS: Record<string, string> = {
  views: "조회",
  impressions: "노출",
  reach: "도달",
  likes: "좋아요",
  comments: "댓글",
  replies: "답글",
  shares: "공유",
  reposts: "리포스트",
  saves: "저장",
  clicks: "클릭",
  inquiries: "문의",
  inquiry_count: "문의",
  bookings: "예약",
  booking_count: "예약",
  conversions: "전환",
  revenue: "매출",
  analytics_event_count: "사이트 이벤트",
};

const RANK_METRICS = ["views", "impressions", "likes", "comments"] as const;

export function performanceChannelKey(channel: string | null | undefined): string {
  const raw = channel?.trim().toLowerCase() ?? "";
  if (!raw) return "all";
  return raw.replace(/:/g, "-");
}

export function performanceWindowKey(input: {
  lookbackDays: number;
  explicitRange: boolean;
  periodStart: string;
  periodEnd: string;
}): string {
  if (input.explicitRange) {
    return `${input.periodStart.slice(0, 10)}_${input.periodEnd.slice(0, 10)}`;
  }
  return `${input.lookbackDays}d`;
}

export function performanceMemorySourceId(
  productId: string,
  channel: string | null | undefined,
  windowKey: string,
): string {
  return `${productId}:${performanceChannelKey(channel)}:${windowKey}`;
}

export function performanceMemoryExpiresAt(now: Date, days = PERFORMANCE_MEMORY_EXPIRES_DAYS): string {
  const expires = new Date(now.getTime());
  expires.setUTCDate(expires.getUTCDate() + days);
  return expires.toISOString();
}

export function performanceMemoryConfidence(signalCount: number): number {
  if (signalCount <= 4) return PERFORMANCE_MEMORY_CONFIDENCE_LOW;
  if (signalCount < 20) return PERFORMANCE_MEMORY_CONFIDENCE_MID;
  return PERFORMANCE_MEMORY_CONFIDENCE_HIGH;
}

export function performanceMemoryImportance(signalCount: number): number {
  if (signalCount <= 4) return PERFORMANCE_MEMORY_IMPORTANCE_LOW;
  if (signalCount < 20) return PERFORMANCE_MEMORY_IMPORTANCE_MID;
  return PERFORMANCE_MEMORY_IMPORTANCE_HIGH;
}

export function usesThreadPublicationFallback(channel: string | null, publicationCount: number): boolean {
  if (publicationCount > 0) return false;
  const key = performanceChannelKey(channel);
  return key === "all" || key === "threads";
}

export function performanceSignalCount(input: {
  publicationCount: number;
  threadPostCount: number;
  feedbackPublicationCount: number;
  inquiryCount: number;
  bookingCount: number;
  analyticsEventCount: number;
  channel: string | null;
}): number {
  if (input.publicationCount > 0) return input.publicationCount;
  if (usesThreadPublicationFallback(input.channel, 0) && input.threadPostCount > 0) {
    return input.threadPostCount;
  }
  if (input.feedbackPublicationCount > 0) return input.feedbackPublicationCount;
  const conversions = input.inquiryCount + input.bookingCount;
  if (conversions > 0) return conversions;
  if (input.analyticsEventCount > 0) return input.analyticsEventCount;
  return 0;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  const [whole, fraction] = String(rounded).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

function metricLabel(metricType: string): string {
  return METRIC_LABELS[metricType] ?? metricType;
}

function periodLabel(window: PerformanceMemoryWindow): string {
  if (window.explicitRange) {
    return `${window.period.start.slice(0, 10)} ~ ${window.period.end.slice(0, 10)}`;
  }
  return `최근 ${window.lookbackDays}일`;
}

function section(title: string, lines: string[]): string | null {
  if (lines.length === 0) return null;
  return `${title}:\n${lines.join("\n")}`;
}

function uniqueFeedbackPublications(feedback: AiFeedbackRow[]): number {
  return new Set(
    feedback
      .map((row) => (typeof row.publication_id === "string" ? row.publication_id : null))
      .filter((id): id is string => Boolean(id)),
  ).size;
}

export function buildPerformanceMetrics(input: PerformanceMemoryMappingInput): MetricSummary[] {
  const primary = sumFeedbackMetrics(input.feedback);
  const extra: MetricSummary[] = [];
  const measuredAt = input.window.period.end;
  if (input.inquiryCount > 0) {
    extra.push({ metricType: "inquiry_count", value: input.inquiryCount, change: null, measuredAt });
  }
  if (input.bookingCount > 0) {
    extra.push({ metricType: "booking_count", value: input.bookingCount, change: null, measuredAt });
  }
  if (primary.length === 0 && input.analyticsEventCount > 0) {
    extra.push({
      metricType: "analytics_event_count",
      value: input.analyticsEventCount,
      change: null,
      measuredAt,
    });
  }
  return mergeMetricsWithoutDuplicate(primary, extra);
}

export function resolvePublicationCount(input: PerformanceMemoryMappingInput): number {
  if (input.publicationCount > 0) return input.publicationCount;
  if (usesThreadPublicationFallback(input.channel, 0)) return input.threadPostCount;
  return 0;
}

function topContentTitles(input: PerformanceMemoryMappingInput): string[] {
  const rankMetric = RANK_METRICS.find((metricType) =>
    input.feedback.some((row) => (typeof row.metric_type === "string" ? row.metric_type.toLowerCase() : "") === metricType),
  );
  if (!rankMetric) return [];
  const titles: string[] = [];
  for (const publicationId of topPublicationIdsByMetric(
    input.feedback,
    rankMetric,
    PERFORMANCE_MEMORY_MAX_TOP_CONTENT,
  )) {
    const contentId = input.publicationContentIds[publicationId];
    const title = contentId ? input.contentTitles[contentId] : undefined;
    const cleaned = title ? normalizeMemoryText(title) : "";
    if (cleaned && !titles.includes(cleaned)) titles.push(cleaned);
  }
  return titles;
}

export function toPerformanceSummary(input: PerformanceMemoryMappingInput): PerformanceSummary {
  const publicationCount = resolvePublicationCount(input);
  const metrics = buildPerformanceMetrics(input);
  return {
    ...mapPerformanceSummary({
      period: input.window.period,
      channel: input.channel,
      productId: input.productId,
      publicationCount,
      rows: [],
      additionalMetrics: metrics,
    }),
    topPerformingContent: topContentTitles(input),
  };
}

export function buildPerformanceMemoryContent(input: PerformanceMemoryMappingInput): string {
  const summary = toPerformanceSummary(input);
  const engagement = ENGAGEMENT_ORDER.filter((type) => hasMetricType(summary.metrics, type)).flatMap((type) => {
    const metric = summary.metrics.find((item) => item.metricType.toLowerCase() === type);
    return metric ? [`- ${metricLabel(type)}: ${formatNumber(metric.value)}`] : [];
  });
  const leftoverEngagement = summary.metrics
    .filter(
      (item) =>
        !CONVERSION_TYPES.has(item.metricType.toLowerCase()) &&
        !(ENGAGEMENT_ORDER as readonly string[]).includes(item.metricType.toLowerCase()) &&
        item.metricType !== "unknown" &&
        item.value > 0,
    )
    .sort((a, b) => a.metricType.localeCompare(b.metricType))
    .map((item) => `- ${metricLabel(item.metricType)}: ${formatNumber(item.value)}`);
  const conversions = summary.metrics
    .filter((item) => CONVERSION_TYPES.has(item.metricType.toLowerCase()) && item.value > 0)
    .sort((a, b) => a.metricType.localeCompare(b.metricType))
    .map((item) => `- ${metricLabel(item.metricType)}: ${formatNumber(item.value)}`);
  const averages =
    summary.publicationCount > 0
      ? ENGAGEMENT_ORDER.flatMap((type) => {
          const metric = summary.metrics.find((item) => item.metricType.toLowerCase() === type);
          if (!metric || metric.value <= 0) return [];
          return [
            `- 게시물당 ${metricLabel(type)}: ${formatNumber(metric.value / summary.publicationCount)}`,
          ];
        })
      : [];

  const sections = [
    input.productTitle ? `상품: ${normalizeMemoryText(input.productTitle)}` : null,
    `채널: ${performanceChannelKey(input.channel) === "all" ? "전체" : performanceChannelKey(input.channel)}`,
    `기간: ${periodLabel(input.window)}`,
    summary.publicationCount > 0 ? `게시 수: ${summary.publicationCount}` : null,
    section("성과", [...engagement, ...leftoverEngagement]),
    section("전환", conversions),
    section("평균", averages),
    section(
      "최고 성과 콘텐츠",
      summary.topPerformingContent.map((title) => `- ${title}`),
    ),
  ].filter((item): item is string => Boolean(item));

  return sections.join("\n\n");
}

export function mapPerformanceToMemoryDocument(
  input: PerformanceMemoryMappingInput,
  now: Date = new Date(),
): MemoryDocument | null {
  const signalCount = performanceSignalCount({
    publicationCount: input.publicationCount,
    threadPostCount: input.threadPostCount,
    feedbackPublicationCount: uniqueFeedbackPublications(input.feedback),
    inquiryCount: input.inquiryCount,
    bookingCount: input.bookingCount,
    analyticsEventCount: input.analyticsEventCount,
    channel: input.channel,
  });
  if (signalCount <= 0) return null;
  const content = buildPerformanceMemoryContent(input);
  if (!content) return null;
  const channelKey = performanceChannelKey(input.channel);
  const title = input.productTitle?.trim()
    ? `${normalizeMemoryText(input.productTitle)} 성과 인사이트`
    : "성과 인사이트";
  return {
    memoryType: PERFORMANCE_MEMORY_TYPE,
    title,
    content,
    sourceType: PERFORMANCE_MEMORY_SOURCE_TYPE,
    sourceId: performanceMemorySourceId(input.productId, input.channel, input.window.key),
    importance: performanceMemoryImportance(signalCount),
    confidence: performanceMemoryConfidence(signalCount),
    expiresAt: performanceMemoryExpiresAt(now),
    metadata: {
      productId: input.productId,
      channel: channelKey,
      inquiryCount: input.inquiryCount,
      bookingCount: input.bookingCount,
      publicationCount: resolvePublicationCount(input),
      signalCount,
      periodStart: input.window.period.start,
      periodEnd: input.window.period.end,
      windowKey: input.window.key,
      sources: {
        ai_feedback: input.feedback.length > 0,
        ai_publications: input.publicationCount > 0,
        thread_marketing_posts: usesThreadPublicationFallback(input.channel, input.publicationCount)
          ? input.threadPostCount > 0
          : false,
        analytics_events: input.feedback.length === 0 && input.analyticsEventCount > 0,
        inquiries: input.inquiryCount > 0 && !hasMetricType(sumFeedbackMetrics(input.feedback), "inquiries"),
        travel_bookings: input.bookingCount > 0 && !hasMetricType(sumFeedbackMetrics(input.feedback), "bookings"),
      },
    },
  };
}
