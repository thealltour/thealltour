import { describe, expect, it, vi } from "vitest";

import { reapStaleRunningMarketingTraces } from "@/lib/marketing/observability/persistence/reapStaleRunning";
import {
  MARKETING_OBS_SPANS_TABLE,
  MARKETING_OBS_TRACES_TABLE,
} from "@/lib/marketing/observability/persistence/types";

function createChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const method of [
    "select",
    "eq",
    "is",
    "lt",
    "order",
    "limit",
    "update",
  ]) {
    chain[method] = vi.fn(self);
  }
  // terminal thenable
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(result));
  return chain;
}

describe("reapStaleRunningMarketingTraces", () => {
  it("dry-run lists stale traces without updates", async () => {
    const selectChain = createChain({
      data: [
        {
          trace_id: "aa".repeat(16),
          status: "running",
          started_at: "2026-09-10T00:00:00.000Z",
          ended_at: null,
          attributes: { keep: true },
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      expect(table).toBe(MARKETING_OBS_TRACES_TABLE);
      return selectChain;
    });
    const result = await reapStaleRunningMarketingTraces({
      client: { from },
      thresholdMs: 30 * 60 * 1000,
      now: new Date("2026-09-18T12:00:00.000Z"),
      dryRun: true,
    });
    expect(result.staleTraceCount).toBe(1);
    expect(result.tracesReaped).toBe(0);
    expect(result.traceIds[0]).toBe("aa".repeat(16));
    expect(selectChain.update).not.toHaveBeenCalled();
  });

  it("finalizes stale traces and open spans", async () => {
    const traceId = "bb".repeat(16);
    let phase: "list" | "updateTrace" | "listSpans" | "updateSpan" = "list";
    const from = vi.fn((table: string) => {
      if (table === MARKETING_OBS_TRACES_TABLE && phase === "list") {
        phase = "updateTrace";
        return createChain({
          data: [
            {
              trace_id: traceId,
              status: "running",
              started_at: "2026-09-10T00:00:00.000Z",
              ended_at: null,
              attributes: { keep: "yes" },
            },
          ],
          error: null,
        });
      }
      if (table === MARKETING_OBS_TRACES_TABLE && phase === "updateTrace") {
        phase = "listSpans";
        const chain = createChain({ data: null, error: null });
        return chain;
      }
      if (table === MARKETING_OBS_SPANS_TABLE && phase === "listSpans") {
        phase = "updateSpan";
        return createChain({
          data: [{ span_id: "span1", started_at: "2026-09-10T00:00:01.000Z" }],
          error: null,
        });
      }
      if (table === MARKETING_OBS_SPANS_TABLE && phase === "updateSpan") {
        return createChain({ data: null, error: null });
      }
      throw new Error(`unexpected from(${table}) phase=${phase}`);
    });

    const result = await reapStaleRunningMarketingTraces({
      client: { from },
      thresholdMs: 30 * 60 * 1000,
      now: new Date("2026-09-18T12:00:00.000Z"),
      dryRun: false,
    });
    expect(result.tracesReaped).toBe(1);
    expect(result.spansReaped).toBe(1);
    expect(result.traceIds).toEqual([traceId]);
  });
});
