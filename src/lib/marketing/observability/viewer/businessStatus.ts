import type { MarketingOtelStatusCode, MarketingSpanStatus } from "@/lib/marketing/observability/types";

/** AgentPrism TraceSpanStatus analogue — kept local so core stays free of AgentPrism. */
export type ViewerSpanVisualStatus = "success" | "error" | "pending" | "warning";

export type BusinessStatusPresentation = {
  code: MarketingSpanStatus | string;
  label: string;
  /** Visual bucket for badges / AgentPrism status override. */
  visual: ViewerSpanVisualStatus;
  /** True when otel ERROR / technical failure. */
  isTechnicalError: boolean;
};

/**
 * Map business outcome separately from OTel ERROR.
 * revision_required / blocked must NOT render as system error.
 */
export function presentBusinessStatus(
  businessStatus: MarketingSpanStatus | string | null | undefined,
  otelStatusCode?: MarketingOtelStatusCode | string | null,
): BusinessStatusPresentation {
  const code = businessStatus ?? "running";
  const technical = otelStatusCode === "ERROR" || code === "error";

  switch (code) {
    case "ok":
      return { code, label: "정상", visual: "success", isTechnicalError: false };
    case "revision_required":
      return { code, label: "수정 필요", visual: "warning", isTechnicalError: false };
    case "blocked":
      return { code, label: "차단", visual: "warning", isTechnicalError: false };
    case "skipped":
      return { code, label: "건너뜀", visual: "pending", isTechnicalError: false };
    case "running":
      return { code, label: "실행 중", visual: "pending", isTechnicalError: false };
    case "error":
      return { code, label: "시스템 오류", visual: "error", isTechnicalError: true };
    default:
      return {
        code,
        label: String(code),
        visual: technical ? "error" : "pending",
        isTechnicalError: technical,
      };
  }
}
