export {
  marketingSpanDisplayName,
  marketingTraceStatusLabel,
} from "@/lib/marketing/observability/viewer/displayLabels";
export {
  presentBusinessStatus,
  type BusinessStatusPresentation,
  type ViewerSpanVisualStatus,
} from "@/lib/marketing/observability/viewer/businessStatus";
export {
  buildSpanDetailGroups,
  type DetailGroup,
  type DetailRow,
} from "@/lib/marketing/observability/viewer/detailsGroups";
export {
  marketingSpanKindDisplay,
  type MarketingSpanKindDisplay,
  type MarketingKindVisualBucket,
} from "@/lib/marketing/observability/viewer/spanKindDisplay";
export {
  applyLiveDelta,
  assessStaleRunning,
  computeLiveDurationMs,
  createPollingMarketingTraceLiveTransport,
  formatLiveDurationMs,
  marketingTraceStatusDisplayLabel,
  mergeTraceDetail,
  mergeTraceList,
  upsertSpanDto,
  upsertTraceListItem,
  DEFAULT_STALE_RUNNING_MS,
  type MarketingTraceLiveConnectionState,
  type MarketingTraceLiveDelta,
  type MarketingTraceLiveTransport,
  type StaleRunningAssessment,
} from "@/lib/marketing/observability/viewer/live";
