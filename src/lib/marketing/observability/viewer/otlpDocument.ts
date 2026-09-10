import type { MarketingSpan, MarketingSpanKind, MarketingTrace } from "@/lib/marketing/observability/types";
import { otelStatusFromSpanStatus } from "@/lib/marketing/observability/validate";
import { marketingSpanDisplayName } from "@/lib/marketing/observability/viewer/displayLabels";

/**
 * AgentPrism-compatible OTLP document shapes (structural — no AgentPrism import).
 * Matches `@evilmartians/agent-prism-types` OpenTelemetryDocument.
 */

export type ViewerOtlpAttribute = {
  key: string;
  value: {
    stringValue?: string;
    intValue?: string;
    boolValue?: boolean;
  };
};

export type ViewerOtlpSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind:
    | "SPAN_KIND_INTERNAL"
    | "SPAN_KIND_SERVER"
    | "SPAN_KIND_CLIENT"
    | "SPAN_KIND_PRODUCER"
    | "SPAN_KIND_CONSUMER";
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: ViewerOtlpAttribute[];
  status: {
    code: "STATUS_CODE_OK" | "STATUS_CODE_ERROR" | "STATUS_CODE_UNSET";
    message?: string;
  };
  flags: number;
};

export type ViewerOtlpDocument = {
  resourceSpans: Array<{
    resource: { attributes: ViewerOtlpAttribute[] };
    scopeSpans: Array<{
      scope: { name: string; version?: string };
      spans: ViewerOtlpSpan[];
    }>;
  }>;
};

const RAW_NAME_ATTR = "marketing.span.name";
const BUSINESS_STATUS_ATTR = "marketing.span.business_status";
const OTEL_STATUS_ATTR = "marketing.span.otel_status";
const ATTEMPT_ATTR = "marketing.span.attempt";
const ACTOR_ATTR = "marketing.span.actor_id";
const OPENINFERENCE_SPAN_KIND = "openinference.span.kind";

function isoToUnixNano(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "0";
  return (BigInt(ms) * BigInt(1_000_000)).toString();
}

function mapKind(kind: MarketingSpanKind): ViewerOtlpSpan["kind"] {
  switch (kind) {
    case "tool":
      return "SPAN_KIND_CLIENT";
    case "human_boundary":
      return "SPAN_KIND_SERVER";
    default:
      return "SPAN_KIND_INTERNAL";
  }
}

/** OpenInference span.kind — distinct buckets for TheAllTour kinds (not collapsed to AGENT/TOOL). */
function openInferenceKind(kind: MarketingSpanKind): string {
  switch (kind) {
    case "agent":
      return "AGENT";
    case "tool":
      return "TOOL";
    case "orchestration":
      return "CHAIN";
    case "deterministic":
      return "CHAIN";
    case "validation":
      return "GUARDRAIL";
    case "human_boundary":
      return "GUARDRAIL";
    default:
      return "CHAIN";
  }
}

function toAttrs(span: MarketingSpan): ViewerOtlpAttribute[] {
  const out: ViewerOtlpAttribute[] = [
    { key: RAW_NAME_ATTR, value: { stringValue: span.name } },
    { key: BUSINESS_STATUS_ATTR, value: { stringValue: span.status } },
    {
      key: OTEL_STATUS_ATTR,
      value: { stringValue: span.otelStatusCode ?? otelStatusFromSpanStatus(span.status) },
    },
    { key: ATTEMPT_ATTR, value: { intValue: String(span.attempt) } },
    { key: OPENINFERENCE_SPAN_KIND, value: { stringValue: openInferenceKind(span.kind) } },
  ];
  if (span.actorId) {
    out.push({ key: ACTOR_ATTR, value: { stringValue: span.actorId } });
  }

  for (const [key, value] of Object.entries(span.attributes ?? {})) {
    // Never forward IO / prompt convention keys even if somehow present.
    if (/^(input|output)\.value$/i.test(key)) continue;
    if (/prompt|model_response|chain_of_thought|secret|api_key|password/i.test(key)) continue;

    if (typeof value === "string") {
      out.push({ key, value: { stringValue: value } });
    } else if (typeof value === "boolean") {
      out.push({ key, value: { boolValue: value } });
    } else if (typeof value === "number") {
      if (Number.isInteger(value)) out.push({ key, value: { intValue: String(value) } });
      else out.push({ key, value: { stringValue: String(value) } });
    } else if (Array.isArray(value)) {
      out.push({ key, value: { stringValue: value.map(String).join(", ") } });
    }
  }
  return out;
}

function mapOtelStatus(
  span: MarketingSpan,
): ViewerOtlpSpan["status"] {
  const code = span.otelStatusCode ?? otelStatusFromSpanStatus(span.status);
  if (code === "ERROR") {
    return { code: "STATUS_CODE_ERROR", message: span.error?.message };
  }
  if (code === "OK") {
    return { code: "STATUS_CODE_OK", message: span.error?.message };
  }
  return { code: "STATUS_CODE_UNSET", message: span.error?.message };
}

export function marketingSpanToViewerOtlpSpan(span: MarketingSpan): ViewerOtlpSpan {
  const start = isoToUnixNano(span.startedAt);
  const end = span.endedAt ? isoToUnixNano(span.endedAt) : start;
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId ?? undefined,
    name: marketingSpanDisplayName(span.name, span.attempt),
    kind: mapKind(span.kind),
    startTimeUnixNano: start,
    endTimeUnixNano: end,
    attributes: toAttrs(span),
    status: mapOtelStatus(span),
    flags: 0,
  };
}

/**
 * Convert MarketingTrace (+ spans) → AgentPrism OTLP document.
 * Reuses OBS-1 semantic fields; does not import AgentPrism packages.
 */
export function marketingTraceToOtlpDocument(
  trace: MarketingTrace,
  spans?: MarketingSpan[],
): ViewerOtlpDocument {
  const list = spans ?? trace.spans ?? [];
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "thealltour-marketing" } },
            { key: "marketing.trace.type", value: { stringValue: trace.traceType } },
            { key: "marketing.trace.status", value: { stringValue: trace.status } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "thealltour.marketing.observability", version: "1" },
            spans: list.map(marketingSpanToViewerOtlpSpan),
          },
        ],
      },
    ],
  };
}

export const VIEWER_OTLP_ATTR = {
  RAW_NAME: RAW_NAME_ATTR,
  BUSINESS_STATUS: BUSINESS_STATUS_ATTR,
  OTEL_STATUS: OTEL_STATUS_ATTR,
  ATTEMPT: ATTEMPT_ATTR,
  ACTOR: ACTOR_ATTR,
} as const;
