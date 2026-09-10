import type {
  MarketingOtelStatusCode,
  MarketingSpan,
  MarketingSpanKind,
  MarketingTrace,
} from "@/lib/marketing/observability/types";
import { otelStatusFromSpanStatus } from "@/lib/marketing/observability/validate";

/**
 * OTel-compatible export shapes for later AgentPrism / OTLP viewers.
 * No AgentPrism-specific types — only fields required for lossless mapping:
 * traceId, spanId, parentSpanId, timestamps, name, status, attributes.
 */

export type OtelCompatibleAttribute = {
  key: string;
  value:
    | { stringValue: string }
    | { intValue: string }
    | { doubleValue: number }
    | { boolValue: boolean }
    | { arrayValue: { values: Array<{ stringValue: string }> } };
};

/** OTel SpanKind numeric codes (proto). */
export const OTEL_SPAN_KIND = {
  INTERNAL: 1,
  SERVER: 2,
  CLIENT: 3,
  PRODUCER: 4,
  CONSUMER: 5,
} as const;

export function mapSpanKindToOtel(kind: MarketingSpanKind): number {
  switch (kind) {
    case "tool":
      return OTEL_SPAN_KIND.CLIENT;
    case "human_boundary":
      return OTEL_SPAN_KIND.SERVER;
    case "agent":
    case "deterministic":
    case "validation":
    case "orchestration":
    case "internal":
    default:
      return OTEL_SPAN_KIND.INTERNAL;
  }
}

export function mapOtelStatusCode(code: MarketingOtelStatusCode | undefined): number {
  // OTel StatusCode: UNSET=0, OK=1, ERROR=2
  if (code === "OK") return 1;
  if (code === "ERROR") return 2;
  return 0;
}

function isoToUnixNano(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "0";
  // Avoid BigInt literals (tsconfig target < ES2020).
  return (BigInt(ms) * BigInt(1_000_000)).toString();
}

function toOtelAttributes(
  attributes: MarketingSpan["attributes"],
): OtelCompatibleAttribute[] {
  const out: OtelCompatibleAttribute[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === "string") {
      out.push({ key, value: { stringValue: value } });
    } else if (typeof value === "boolean") {
      out.push({ key, value: { boolValue: value } });
    } else if (typeof value === "number") {
      if (Number.isInteger(value)) {
        out.push({ key, value: { intValue: String(value) } });
      } else {
        out.push({ key, value: { doubleValue: value } });
      }
    } else if (Array.isArray(value)) {
      out.push({
        key,
        value: {
          arrayValue: {
            values: value.map((item) => ({ stringValue: String(item) })),
          },
        },
      });
    }
  }
  return out;
}

export type OtelCompatibleSpanExport = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano?: string;
  status: { code: number; message?: string };
  attributes: OtelCompatibleAttribute[];
  /** Preserved domain business status for viewers that support extras. */
  marketingStatus: MarketingSpan["status"];
};

export function toOtelCompatibleSpan(span: MarketingSpan): OtelCompatibleSpanExport {
  const otelCode = span.otelStatusCode ?? otelStatusFromSpanStatus(span.status);
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId ?? undefined,
    name: span.name,
    kind: mapSpanKindToOtel(span.kind),
    startTimeUnixNano: isoToUnixNano(span.startedAt),
    endTimeUnixNano: span.endedAt ? isoToUnixNano(span.endedAt) : undefined,
    status: {
      code: mapOtelStatusCode(otelCode),
      message: span.error?.message,
    },
    attributes: toOtelAttributes(span.attributes),
    marketingStatus: span.status,
  };
}

export function toOtelCompatibleTraceExport(trace: MarketingTrace): {
  traceId: string;
  spans: OtelCompatibleSpanExport[];
} {
  return {
    traceId: trace.traceId,
    spans: (trace.spans ?? []).map(toOtelCompatibleSpan),
  };
}

/**
 * Feasibility check: required AgentPrism/OTel viewer fields are present and non-empty.
 */
export function assertAgentPrismMappingFeasible(span: MarketingSpan): {
  ok: boolean;
  missing: string[];
} {
  const exported = toOtelCompatibleSpan(span);
  const missing: string[] = [];
  if (!exported.traceId) missing.push("traceId");
  if (!exported.spanId) missing.push("spanId");
  if (!exported.name) missing.push("name");
  if (!exported.startTimeUnixNano || exported.startTimeUnixNano === "0") missing.push("timestamps");
  if (exported.status == null) missing.push("status");
  if (!Array.isArray(exported.attributes)) missing.push("attributes");
  return { ok: missing.length === 0, missing };
}
