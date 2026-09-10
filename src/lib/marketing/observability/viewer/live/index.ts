export type {
  MarketingTraceLiveConnectionState,
  MarketingTraceLiveDelta,
  MarketingTraceLiveEventType,
  MarketingTraceLiveFetchers,
  MarketingTraceLiveTransport,
  MarketingTraceLiveTransportHandlers,
} from "@/lib/marketing/observability/viewer/live/types";

export {
  applyLiveDelta,
  diffSpanDeltas,
  diffTraceListDeltas,
  mergeTraceDetail,
  mergeTraceList,
  upsertSpanDto,
  upsertTraceListItem,
} from "@/lib/marketing/observability/viewer/live/merge";

export {
  computeLiveDurationMs,
  formatLiveDurationMs,
} from "@/lib/marketing/observability/viewer/live/duration";

export {
  assessStaleRunning,
  DEFAULT_STALE_RUNNING_MS,
  marketingTraceStatusDisplayLabel,
  type StaleRunningAssessment,
} from "@/lib/marketing/observability/viewer/live/staleRunning";

export {
  createPollingMarketingTraceLiveTransport,
  defaultAdminTraceFetchers,
  type PollingMarketingTraceLiveTransportOptions,
} from "@/lib/marketing/observability/viewer/live/pollingTransport";
