import { openTelemetrySpanAdapter } from "@evilmartians/agent-prism-data";
import type { TraceRecord, TraceSpan } from "@evilmartians/agent-prism-types";

import type { MarketingSpan, MarketingTrace } from "@/lib/marketing/observability/types";
import { presentBusinessStatus } from "@/lib/marketing/observability/viewer/businessStatus";
import {
  marketingTraceToOtlpDocument,
  type ViewerOtlpDocument,
} from "@/lib/marketing/observability/viewer/otlpDocument";
import { marketingTraceStatusLabel } from "@/lib/marketing/observability/viewer/displayLabels";

/**
 * UI boundary: MarketingTrace → AgentPrism TraceSpan tree.
 * Core observability packages never import AgentPrism.
 */
export function marketingTraceToAgentPrismSpans(
  trace: MarketingTrace,
  spans?: MarketingSpan[],
): TraceSpan[] {
  const list = spans ?? trace.spans ?? [];
  const byId = new Map(list.map((s) => [s.spanId, s]));
  const doc = marketingTraceToOtlpDocument(trace, list) as ViewerOtlpDocument;
  const tree = openTelemetrySpanAdapter.convertRawDocumentsToSpans(
    doc as Parameters<typeof openTelemetrySpanAdapter.convertRawDocumentsToSpans>[0],
  );

  const remap = (node: TraceSpan): TraceSpan => {
    const marketing = byId.get(node.id);
    const presented = presentBusinessStatus(
      marketing?.status ?? null,
      marketing?.otelStatusCode ?? null,
    );
    return {
      ...node,
      // Never surface IO even if adapter filled from attributes.
      input: undefined,
      output: undefined,
      status: presented.visual,
      children: node.children?.map(remap),
    };
  };

  return tree.map(remap);
}

export function marketingTraceToTraceRecord(
  trace: MarketingTrace,
  spans?: MarketingSpan[],
): TraceRecord {
  const list = spans ?? trace.spans ?? [];
  const started = Date.parse(trace.startedAt);
  const ended = trace.endedAt ? Date.parse(trace.endedAt) : Date.now();
  const durationMs =
    Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, ended - started) : 0;

  return {
    id: trace.traceId,
    name: `${marketingTraceStatusLabel(trace.status)} · ${trace.traceType}`,
    spansCount: list.length,
    durationMs,
    agentDescription: trace.productionRequestId
      ? `PR ${shortId(trace.productionRequestId)}`
      : trace.logicalRunKey
        ? `Run ${shortId(trace.logicalRunKey)}`
        : "Marketing production",
    startTime: Number.isFinite(started) ? started : undefined,
  };
}

export function shortId(value: string, keep = 10): string {
  if (value.length <= keep + 1) return value;
  return `${value.slice(0, keep)}…`;
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
