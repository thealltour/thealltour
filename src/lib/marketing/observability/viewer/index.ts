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
  marketingTraceToOtlpDocument,
  marketingSpanToViewerOtlpSpan,
  VIEWER_OTLP_ATTR,
  type ViewerOtlpDocument,
  type ViewerOtlpSpan,
} from "@/lib/marketing/observability/viewer/otlpDocument";
