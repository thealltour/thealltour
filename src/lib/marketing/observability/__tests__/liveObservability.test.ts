import { describe, expect, it, vi } from "vitest";

import { createMarketingSpanId, createMarketingTraceId } from "@/lib/marketing/observability/ids";
import type {
  MarketingSpanDto,
  MarketingTraceDetailDto,
  MarketingTraceListItemDto,
} from "@/lib/marketing/observability/viewer/dto";
import { marketingSpanDisplayName } from "@/lib/marketing/observability/viewer/displayLabels";
import {
  applyLiveDelta,
  assessStaleRunning,
  computeLiveDurationMs,
  createPollingMarketingTraceLiveTransport,
  diffSpanDeltas,
  diffTraceListDeltas,
  formatLiveDurationMs,
  marketingTraceStatusDisplayLabel,
  mergeTraceDetail,
  mergeTraceList,
  upsertSpanDto,
  upsertTraceListItem,
  type MarketingTraceLiveConnectionState,
  type MarketingTraceLiveDelta,
} from "@/lib/marketing/observability/viewer/live";

function listItem(
  partial: Partial<MarketingTraceListItemDto> & Pick<MarketingTraceListItemDto, "traceId">,
): MarketingTraceListItemDto {
  return {
    traceType: "marketing_production",
    status: "running",
    startedAt: "2026-09-10T10:00:00.000Z",
    endedAt: null,
    durationMs: null,
    productionRequestId: null,
    logicalRunKey: null,
    assignmentId: null,
    candidateId: null,
    reviewId: null,
    spanCount: 0,
    ...partial,
  };
}

function spanDto(
  partial: Partial<MarketingSpanDto> & Pick<MarketingSpanDto, "spanId" | "traceId" | "name">,
): MarketingSpanDto {
  return {
    parentSpanId: null,
    kind: "agent",
    actorType: "agent",
    actorId: null,
    stage: "content_strategist",
    attempt: 1,
    status: "running",
    otelStatusCode: "UNSET",
    startedAt: "2026-09-10T10:00:01.000Z",
    endedAt: null,
    durationMs: null,
    attributes: {},
    error: null,
    ...partial,
  };
}

describe("OBS-5 live merge", () => {
  it("upserts traces by traceId without duplicates", () => {
    const a = listItem({ traceId: "a".repeat(32), status: "running", spanCount: 0 });
    const b = listItem({
      traceId: "b".repeat(32),
      status: "completed",
      startedAt: "2026-09-10T10:01:00.000Z",
      endedAt: "2026-09-10T10:01:10.000Z",
      durationMs: 10_000,
      spanCount: 3,
    });
    let list = mergeTraceList([], [a, b]);
    expect(list).toHaveLength(2);
    list = upsertTraceListItem(list, { ...a, status: "completed", spanCount: 8, endedAt: "2026-09-10T10:00:40.000Z" });
    expect(list).toHaveLength(2);
    expect(list.find((t) => t.traceId === a.traceId)?.status).toBe("completed");
    expect(list.find((t) => t.traceId === a.traceId)?.spanCount).toBe(8);
  });

  it("preserves selection-relevant detail merge for span insert/update", () => {
    const traceId = createMarketingTraceId();
    const s1 = createMarketingSpanId();
    const s2 = createMarketingSpanId();
    const detail: MarketingTraceDetailDto = {
      trace: {
        ...listItem({ traceId, spanCount: 1 }),
        agendaSlateId: null,
        agendaCandidateId: null,
        rootSpanId: s1,
      },
      spans: [spanDto({ spanId: s1, traceId, name: "marketing.production", kind: "orchestration", status: "running" })],
    };
    const withCs = mergeTraceDetail(detail, {
      ...detail,
      spans: [
        ...detail.spans,
        spanDto({ spanId: s2, traceId, name: "marketing.content_strategist", status: "running", attempt: 1 }),
      ],
    });
    expect(withCs.spans).toHaveLength(2);

    const updated = mergeTraceDetail(withCs, {
      ...withCs,
      spans: withCs.spans.map((s) =>
        s.spanId === s2
          ? { ...s, status: "ok", otelStatusCode: "OK", endedAt: "2026-09-10T10:00:20.000Z", durationMs: 19_000 }
          : s,
      ),
    });
    expect(updated.spans.find((s) => s.spanId === s2)?.status).toBe("ok");
    expect(updated.spans).toHaveLength(2);
  });

  it("is idempotent for duplicate deltas", () => {
    const traceId = createMarketingTraceId();
    const item = listItem({ traceId, status: "running" });
    const delta: MarketingTraceLiveDelta = {
      eventType: "trace_inserted",
      traceId,
      eventAt: "2026-09-10T10:00:00.000Z",
      trace: item,
    };
    let state = applyLiveDelta({ traces: [], detail: null, selectedTraceId: null }, delta);
    state = applyLiveDelta({ ...state, selectedTraceId: null }, delta);
    expect(state.traces).toHaveLength(1);
  });

  it("does not clear selection when list updates", () => {
    const selected = createMarketingTraceId();
    const other = createMarketingTraceId();
    const s1 = createMarketingSpanId();
    const detail: MarketingTraceDetailDto = {
      trace: {
        ...listItem({ traceId: selected, spanCount: 1 }),
        agendaSlateId: null,
        agendaCandidateId: null,
        rootSpanId: s1,
      },
      spans: [spanDto({ spanId: s1, traceId: selected, name: "marketing.production" })],
    };
    const applied = applyLiveDelta(
      { traces: [listItem({ traceId: selected })], detail, selectedTraceId: selected },
      {
        eventType: "list_synced",
        eventAt: "2026-09-10T10:00:05.000Z",
        traces: [
          listItem({ traceId: other, startedAt: "2026-09-10T10:00:05.000Z" }),
          listItem({ traceId: selected, status: "running", spanCount: 2 }),
        ],
      },
    );
    expect(applied.detail?.trace.traceId).toBe(selected);
    expect(applied.traces.map((t) => t.traceId)).toContain(selected);
  });

  it("keeps both revision attempts", () => {
    const traceId = createMarketingTraceId();
    const cs1 = createMarketingSpanId();
    const v1 = createMarketingSpanId();
    const cs2 = createMarketingSpanId();
    const prev: MarketingSpanDto[] = [
      spanDto({
        spanId: cs1,
        traceId,
        name: "marketing.content_strategist",
        attempt: 1,
        status: "ok",
        otelStatusCode: "OK",
      }),
      spanDto({
        spanId: v1,
        traceId,
        name: "marketing.completeness_validator",
        attempt: 1,
        status: "revision_required",
        otelStatusCode: "OK",
        kind: "validation",
      }),
    ];
    const next = [
      ...prev,
      spanDto({
        spanId: cs2,
        traceId,
        name: "marketing.content_strategist",
        attempt: 2,
        status: "running",
      }),
    ];
    const deltas = diffSpanDeltas(traceId, prev, next);
    expect(deltas.some((d) => d.eventType === "span_inserted" && "spanId" in d && d.spanId === cs2)).toBe(
      true,
    );
    let detail: MarketingTraceDetailDto = {
      trace: {
        ...listItem({ traceId, spanCount: 2 }),
        agendaSlateId: null,
        agendaCandidateId: null,
        rootSpanId: null,
      },
      spans: prev,
    };
    for (const d of deltas) {
      const applied = applyLiveDelta(
        { traces: [listItem({ traceId })], detail, selectedTraceId: traceId },
        d,
      );
      detail = applied.detail!;
    }
    expect(detail.spans.filter((s) => s.name === "marketing.content_strategist")).toHaveLength(2);
    expect(marketingSpanDisplayName("marketing.content_strategist", 1)).toBe("Content Strategist #1");
    expect(marketingSpanDisplayName("marketing.content_strategist", 2)).toBe("Content Strategist #2");
    expect(marketingSpanDisplayName("marketing.completeness_validator", 1)).toBe(
      "Completeness Validator #1",
    );
  });

  it("applies technical ERROR updates without treating revision_required as error", () => {
    const traceId = createMarketingTraceId();
    const spanId = createMarketingSpanId();
    const detail: MarketingTraceDetailDto = {
      trace: {
        ...listItem({ traceId }),
        agendaSlateId: null,
        agendaCandidateId: null,
        rootSpanId: null,
      },
      spans: [spanDto({ spanId, traceId, name: "marketing.content_strategist", status: "running" })],
    };
    const errored = spanDto({
      spanId,
      traceId,
      name: "marketing.content_strategist",
      status: "error",
      otelStatusCode: "ERROR",
      endedAt: "2026-09-10T10:00:12.000Z",
      durationMs: 11_000,
      error: { class: "HermesInvocationError", message: "timeout", pipelineFailureCode: null },
    });
    const spans = upsertSpanDto(detail.spans, errored);
    expect(spans[0].otelStatusCode).toBe("ERROR");
    expect(spans[0].error?.class).toBe("HermesInvocationError");
    expect(spans[0].error).not.toHaveProperty("stderr");
  });
});

describe("OBS-5 duration + stale", () => {
  it("computes live duration from startedAt without DB heartbeat", () => {
    const ms = computeLiveDurationMs(
      "2026-09-10T10:00:00.000Z",
      null,
      Date.parse("2026-09-10T10:00:18.400Z"),
    );
    expect(ms).toBe(18_400);
    expect(formatLiveDurationMs(ms)).toBe("18.4s");
    expect(
      computeLiveDurationMs(
        "2026-09-10T10:00:00.000Z",
        "2026-09-10T10:00:10.000Z",
        Date.parse("2026-09-10T10:00:99.000Z"),
      ),
    ).toBe(10_000);
  });

  it("marks long-running rows as STALE display without mutating DB semantics", () => {
    const startedAt = "2026-09-10T08:00:00.000Z";
    const nowMs = Date.parse("2026-09-10T09:00:00.000Z");
    const stale = assessStaleRunning({
      status: "running",
      startedAt,
      endedAt: null,
      nowMs,
      thresholdMs: 30 * 60 * 1000,
    });
    expect(stale.isStale).toBe(true);
    expect(stale.label).toBe("오래된 실행");
    expect(marketingTraceStatusDisplayLabel("running", stale)).toBe("STALE");
    expect(
      assessStaleRunning({
        status: "running",
        startedAt,
        endedAt: null,
        nowMs: Date.parse("2026-09-10T08:05:00.000Z"),
      }).isStale,
    ).toBe(false);
    expect(
      assessStaleRunning({
        status: "completed",
        startedAt,
        endedAt: "2026-09-10T08:01:00.000Z",
        nowMs,
      }).isStale,
    ).toBe(false);
  });
});

describe("OBS-5 polling transport", () => {
  it("reconnects and resyncs missed list/detail state", async () => {
    const traceId = createMarketingTraceId();
    const spanA = createMarketingSpanId();
    const spanB = createMarketingSpanId();

    let listVersion = 0;
    let detailVersion = 0;
    const states: MarketingTraceLiveConnectionState[] = [];
    const deltas: MarketingTraceLiveDelta[] = [];

    const intervals: Array<{ fn: () => void; ms: number }> = [];
    const transport = createPollingMarketingTraceLiveTransport({
      activeIntervalMs: 10,
      idleIntervalMs: 1000,
      fetchers: {
        async fetchRecentTraces() {
          listVersion += 1;
          if (listVersion === 1) {
            return [listItem({ traceId, status: "running", spanCount: 1 })];
          }
          return [listItem({ traceId, status: "completed", spanCount: 2, endedAt: "2026-09-10T10:00:30.000Z" })];
        },
        async fetchTraceDetail(id: string) {
          detailVersion += 1;
          const spans =
            detailVersion === 1
              ? [spanDto({ spanId: spanA, traceId: id, name: "marketing.production", status: "running" })]
              : [
                  spanDto({
                    spanId: spanA,
                    traceId: id,
                    name: "marketing.production",
                    status: "ok",
                    otelStatusCode: "OK",
                    endedAt: "2026-09-10T10:00:30.000Z",
                  }),
                  spanDto({
                    spanId: spanB,
                    traceId: id,
                    name: "marketing.content_strategist",
                    status: "ok",
                    otelStatusCode: "OK",
                    endedAt: "2026-09-10T10:00:25.000Z",
                  }),
                ];
          return {
            trace: {
              ...listItem({
                traceId: id,
                status: detailVersion === 1 ? "running" : "completed",
                spanCount: spans.length,
                endedAt: detailVersion === 1 ? null : "2026-09-10T10:00:30.000Z",
              }),
              agendaSlateId: null,
              agendaCandidateId: null,
              rootSpanId: spanA,
            },
            spans,
          };
        },
      },
      handlers: {
        onConnectionState: (s) => states.push(s),
        onDelta: (d) => deltas.push(d),
      },
      schedule: {
        setInterval: (fn, ms) => {
          intervals.push({ fn, ms });
          return intervals.length as unknown as ReturnType<typeof setInterval>;
        },
        clearInterval: () => undefined,
      },
    });

    transport.setSelectedTraceId(traceId);
    transport.start();
    await vi.waitFor(() => expect(deltas.some((d) => d.eventType === "detail_synced")).toBe(true));

    // Simulate disconnect recovery via forced resync (missed events).
    await transport.resync();
    const lastDetail = [...deltas].reverse().find((d) => d.eventType === "detail_synced");
    expect(lastDetail && lastDetail.eventType === "detail_synced" && lastDetail.detail.spans).toHaveLength(2);
    expect(lastDetail && lastDetail.eventType === "detail_synced" && lastDetail.detail.trace.status).toBe(
      "completed",
    );
    expect(states).toContain("live");
    expect(states).toContain("connecting");

    const listDiff = diffTraceListDeltas(
      [listItem({ traceId, status: "running" })],
      [listItem({ traceId, status: "failed", endedAt: "2026-09-10T10:00:40.000Z" })],
    );
    expect(listDiff[0]?.eventType).toBe("trace_updated");

    transport.stop();
  });

  it("surfaces offline after repeated failures without throwing to caller tick", async () => {
    const states: MarketingTraceLiveConnectionState[] = [];
    let calls = 0;
    const transport = createPollingMarketingTraceLiveTransport({
      activeIntervalMs: 5,
      idleIntervalMs: 5,
      fetchers: {
        async fetchRecentTraces() {
          calls += 1;
          throw new Error("network");
        },
        async fetchTraceDetail() {
          throw new Error("network");
        },
      },
      handlers: {
        onConnectionState: (s) => states.push(s),
        onDelta: () => undefined,
        onError: () => undefined,
      },
      schedule: {
        setInterval: () => 1 as unknown as ReturnType<typeof setInterval>,
        clearInterval: () => undefined,
      },
    });
    transport.start();
    await vi.waitFor(() => expect(calls).toBeGreaterThanOrEqual(1));
    // Manual failures to trip offline threshold
    await expect(transport.resync()).rejects.toThrow();
    await expect(transport.resync()).rejects.toThrow();
    await expect(transport.resync()).rejects.toThrow();
    expect(states).toContain("offline");
    transport.stop();
  });
});

describe("OBS-5 privacy projection", () => {
  it("list/detail DTOs used by live deltas omit raw secrets fields by shape", () => {
    const item = listItem({ traceId: createMarketingTraceId() });
    expect(item).not.toHaveProperty("attributes");
    expect(item).not.toHaveProperty("serviceRoleKey");
    const span = spanDto({
      spanId: createMarketingSpanId(),
      traceId: item.traceId,
      name: "marketing.content_strategist",
      error: { class: "X", message: "safe", pipelineFailureCode: null },
    });
    expect(Object.keys(span.error ?? {})).toEqual(["class", "message", "pipelineFailureCode"]);
  });
});
