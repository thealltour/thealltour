import type { MarketingSpanKind } from "@/lib/marketing/observability/types";

/**
 * UI-boundary display for MarketingSpan.kind.
 * Does not alter stored trace data or AgentPrism core types in the domain layer.
 *
 * AgentPrism TraceSpanCategory is reused only as a visual bucket; labels below
 * are TheAllTour semantics shown in the admin tree badge.
 */
export type MarketingKindVisualBucket =
  | "agent_invocation"
  | "chain_operation"
  | "tool_execution"
  | "span"
  | "event"
  | "guardrail"
  | "unknown";

export type MarketingSpanKindDisplay = {
  /** Badge text in the AgentPrism tree. */
  label: string;
  /** Closest AgentPrism category bucket (visual only). */
  visualBucket: MarketingKindVisualBucket;
};

export function marketingSpanKindDisplay(kind: MarketingSpanKind | string): MarketingSpanKindDisplay {
  switch (kind) {
    case "agent":
      return { label: "AGENT", visualBucket: "agent_invocation" };
    case "orchestration":
      return { label: "ORCHESTRATION", visualBucket: "chain_operation" };
    case "deterministic":
      return { label: "DETERMINISTIC", visualBucket: "span" };
    case "validation":
      return { label: "VALIDATION", visualBucket: "event" };
    case "human_boundary":
      return { label: "HUMAN BOUNDARY", visualBucket: "guardrail" };
    case "tool":
      return { label: "TOOL", visualBucket: "tool_execution" };
    case "internal":
      return { label: "INTERNAL", visualBucket: "unknown" };
    default:
      return { label: String(kind).toUpperCase(), visualBucket: "unknown" };
  }
}
