import type {
  MarketingSpanDto,
  MarketingTraceDetailDto,
  MarketingTraceListItemDto,
} from "@/lib/marketing/observability/viewer/dto";
import type { MarketingTraceLiveDelta } from "@/lib/marketing/observability/viewer/live/types";

function startedAtMs(item: { startedAt: string }): number {
  const t = Date.parse(item.startedAt);
  return Number.isFinite(t) ? t : 0;
}

/** Upsert one list row by traceId; newest startedAt first. Idempotent. */
export function upsertTraceListItem(
  prev: MarketingTraceListItemDto[],
  next: MarketingTraceListItemDto,
): MarketingTraceListItemDto[] {
  const idx = prev.findIndex((t) => t.traceId === next.traceId);
  const merged = idx >= 0 ? [...prev] : [next, ...prev];
  if (idx >= 0) {
    merged[idx] = { ...prev[idx], ...next };
  }
  return merged.sort((a, b) => startedAtMs(b) - startedAtMs(a));
}

/** Replace/merge list snapshot by traceId (no duplicates). Preserves unknown order preference via startedAt. */
export function mergeTraceList(
  prev: MarketingTraceListItemDto[],
  incoming: MarketingTraceListItemDto[],
): MarketingTraceListItemDto[] {
  const map = new Map<string, MarketingTraceListItemDto>();
  for (const t of prev) map.set(t.traceId, t);
  for (const t of incoming) {
    const existing = map.get(t.traceId);
    map.set(t.traceId, existing ? { ...existing, ...t } : t);
  }
  // Prefer incoming order when it is a full recent list sync; otherwise sort.
  if (incoming.length > 0 && incoming.length >= Math.min(prev.length, incoming.length)) {
    const incomingIds = new Set(incoming.map((t) => t.traceId));
    const ordered = incoming.map((t) => map.get(t.traceId)!);
    for (const t of prev) {
      if (!incomingIds.has(t.traceId)) ordered.push(map.get(t.traceId)!);
    }
    return ordered;
  }
  return Array.from(map.values()).sort((a, b) => startedAtMs(b) - startedAtMs(a));
}

/** Span keyed merge — insert or update by spanId without wiping siblings. */
export function upsertSpanDto(prev: MarketingSpanDto[], next: MarketingSpanDto): MarketingSpanDto[] {
  const idx = prev.findIndex((s) => s.spanId === next.spanId);
  if (idx < 0) return [...prev, next];
  const out = [...prev];
  out[idx] = { ...prev[idx], ...next };
  return out;
}

export function mergeTraceDetail(
  prev: MarketingTraceDetailDto | null,
  next: MarketingTraceDetailDto,
): MarketingTraceDetailDto {
  if (!prev || prev.trace.traceId !== next.trace.traceId) {
    return next;
  }
  const spanMap = new Map<string, MarketingSpanDto>();
  for (const s of prev.spans) spanMap.set(s.spanId, s);
  for (const s of next.spans) {
    const existing = spanMap.get(s.spanId);
    spanMap.set(s.spanId, existing ? { ...existing, ...s } : s);
  }
  // Keep next's span order when provided (DB list order); append any prev-only leftovers.
  const nextIds = new Set(next.spans.map((s) => s.spanId));
  const spans = [
    ...next.spans.map((s) => spanMap.get(s.spanId)!),
    ...prev.spans.filter((s) => !nextIds.has(s.spanId)).map((s) => spanMap.get(s.spanId)!),
  ];
  return {
    trace: { ...prev.trace, ...next.trace, spanCount: spans.length },
    spans,
  };
}

/**
 * Apply a live delta onto list + optional selected detail.
 * Selection id is never cleared by list merges.
 */
export function applyLiveDelta(state: {
  traces: MarketingTraceListItemDto[];
  detail: MarketingTraceDetailDto | null;
  selectedTraceId: string | null;
}, delta: MarketingTraceLiveDelta): {
  traces: MarketingTraceListItemDto[];
  detail: MarketingTraceDetailDto | null;
} {
  switch (delta.eventType) {
    case "list_synced":
      return {
        // Recent list snapshot is authoritative for the window (avoids unbounded append).
        traces: delta.traces.map((t) => {
          const prev = state.traces.find((p) => p.traceId === t.traceId);
          return prev ? { ...prev, ...t } : t;
        }),
        detail: state.detail,
      };
    case "trace_inserted":
    case "trace_updated":
      return {
        traces: upsertTraceListItem(state.traces, delta.trace),
        detail:
          state.detail && state.detail.trace.traceId === delta.traceId
            ? {
                ...state.detail,
                trace: {
                  ...state.detail.trace,
                  ...delta.trace,
                  agendaSlateId: state.detail.trace.agendaSlateId,
                  agendaCandidateId: state.detail.trace.agendaCandidateId,
                  rootSpanId: state.detail.trace.rootSpanId,
                },
              }
            : state.detail,
      };
    case "detail_synced":
      return {
        traces: upsertTraceListItem(state.traces, {
          traceId: delta.detail.trace.traceId,
          traceType: delta.detail.trace.traceType,
          status: delta.detail.trace.status,
          startedAt: delta.detail.trace.startedAt,
          endedAt: delta.detail.trace.endedAt,
          durationMs: delta.detail.trace.durationMs,
          productionRequestId: delta.detail.trace.productionRequestId,
          logicalRunKey: delta.detail.trace.logicalRunKey,
          assignmentId: delta.detail.trace.assignmentId,
          candidateId: delta.detail.trace.candidateId,
          reviewId: delta.detail.trace.reviewId,
          spanCount: delta.detail.spans.length,
        }),
        detail:
          state.selectedTraceId === delta.traceId
            ? mergeTraceDetail(state.detail, delta.detail)
            : state.detail,
      };
    case "span_inserted":
    case "span_updated": {
      if (!state.detail || state.detail.trace.traceId !== delta.traceId) {
        return { traces: state.traces, detail: state.detail };
      }
      const spans = upsertSpanDto(state.detail.spans, delta.span);
      return {
        traces: state.traces,
        detail: {
          ...state.detail,
          trace: { ...state.detail.trace, spanCount: spans.length },
          spans,
        },
      };
    }
    default:
      return { traces: state.traces, detail: state.detail };
  }
}

/** Diff two list snapshots into insert/update deltas (for tests / optional event fan-out). */
export function diffTraceListDeltas(
  prev: MarketingTraceListItemDto[],
  next: MarketingTraceListItemDto[],
  eventAt = new Date().toISOString(),
): MarketingTraceLiveDelta[] {
  const prevMap = new Map(prev.map((t) => [t.traceId, t]));
  const out: MarketingTraceLiveDelta[] = [];
  for (const t of next) {
    const before = prevMap.get(t.traceId);
    if (!before) {
      out.push({ eventType: "trace_inserted", traceId: t.traceId, eventAt, trace: t });
    } else if (
      before.status !== t.status ||
      before.endedAt !== t.endedAt ||
      before.spanCount !== t.spanCount ||
      before.durationMs !== t.durationMs
    ) {
      out.push({ eventType: "trace_updated", traceId: t.traceId, eventAt, trace: t });
    }
  }
  return out;
}

/** Diff span arrays into insert/update deltas. */
export function diffSpanDeltas(
  traceId: string,
  prev: MarketingSpanDto[],
  next: MarketingSpanDto[],
  eventAt = new Date().toISOString(),
): MarketingTraceLiveDelta[] {
  const prevMap = new Map(prev.map((s) => [s.spanId, s]));
  const out: MarketingTraceLiveDelta[] = [];
  for (const s of next) {
    const before = prevMap.get(s.spanId);
    if (!before) {
      out.push({ eventType: "span_inserted", traceId, spanId: s.spanId, eventAt, span: s });
    } else if (
      before.status !== s.status ||
      before.endedAt !== s.endedAt ||
      before.otelStatusCode !== s.otelStatusCode ||
      before.durationMs !== s.durationMs
    ) {
      out.push({ eventType: "span_updated", traceId, spanId: s.spanId, eventAt, span: s });
    }
  }
  return out;
}
