export {
  MARKETING_OBS_ANALYTICS_RANGES,
  DEFAULT_MARKETING_OBS_ANALYTICS_RANGE,
  isMarketingObsAnalyticsRange,
  resolveMarketingObsAnalyticsWindow,
  type MarketingObsAnalyticsRange,
  type MarketingObsAnalyticsWindow,
} from "@/lib/marketing/observability/viewer/analytics/range";

export {
  ANALYTICS_BOTTLENECK_STAGES,
  aggregateMarketingObservabilityAnalytics,
} from "@/lib/marketing/observability/viewer/analytics/aggregate";

export {
  ANALYTICS_INSUFFICIENT_SAMPLE,
  medianMs,
  p95Ms,
  sampledDuration,
  sampledRate,
} from "@/lib/marketing/observability/viewer/analytics/stats";

export {
  attributesIndicateFixture,
  MARKETING_FIXTURE_ATTR,
} from "@/lib/marketing/observability/viewer/analytics/fixture";

export type {
  AnalyticsSpanInput,
  AnalyticsTraceInput,
  MarketingObservabilityAnalyticsDto,
  StageBottleneckRow,
} from "@/lib/marketing/observability/viewer/analytics/types";
