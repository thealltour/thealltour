vi.mock("server-only", () => ({}));

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/apiAuth", () => ({
  requireAdminPermission: vi.fn(),
}));

vi.mock("@/lib/marketing/observability/viewer/serverReadRepository", () => ({
  createServerMarketingTraceReadRepository: vi.fn(),
}));

import { requireAdminPermission } from "@/lib/apiAuth";
import { createServerMarketingTraceReadRepository } from "@/lib/marketing/observability/viewer/serverReadRepository";
import { GET as listTraces } from "@/app/api/admin/marketing-observability/traces/route";
import { GET as getTrace } from "@/app/api/admin/marketing-observability/traces/[traceId]/route";
import { createMarketingTraceId, createMarketingSpanId } from "@/lib/marketing/observability/ids";
import {
  MARKETING_SPAN_CONTRACT,
  MARKETING_TRACE_CONTRACT,
} from "@/lib/marketing/observability/types";

describe("OBS-4 marketing-observability read API", () => {
  beforeEach(() => {
    vi.mocked(requireAdminPermission).mockReset();
    vi.mocked(createServerMarketingTraceReadRepository).mockReset();
  });

  it("rejects unauthorized list", async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({
      ok: false,
      res: Response.json({ message: "forbidden" }, { status: 403 }),
    } as never);
    const res = await listTraces(new Request("http://localhost/api/admin/marketing-observability/traces"));
    expect(res.status).toBe(403);
  });

  it("lists recent traces for settings.manage", async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({ ok: true, session: {} } as never);
    const traceId = createMarketingTraceId();
    vi.mocked(createServerMarketingTraceReadRepository).mockResolvedValue({
      listRecentTraces: async () => [
        {
          contract: MARKETING_TRACE_CONTRACT,
          traceId,
          traceType: "marketing_production",
          status: "completed",
          startedAt: "2026-09-10T08:00:00.000Z",
          endedAt: "2026-09-10T08:00:41.000Z",
          productionRequestId: "obs3-smoke-pr-1",
          spans: [],
        },
      ],
      getTrace: async () => null,
      listTraceSpans: async () => [],
      findTraceByProductionRequestId: async () => null,
    } as never);

    const res = await listTraces(
      new Request("http://localhost/api/admin/marketing-observability/traces?limit=20"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.traces).toHaveLength(1);
    expect(body.traces[0].traceId).toBe(traceId);
    expect(body.traces[0].durationMs).toBe(41000);
  });

  it("validates traceId hex contract", async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({ ok: true, session: {} } as never);
    const res = await getTrace(new Request("http://localhost/x"), {
      params: Promise.resolve({ traceId: "not-a-trace-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns detail with spans", async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({ ok: true, session: {} } as never);
    const traceId = createMarketingTraceId();
    const spanId = createMarketingSpanId();
    vi.mocked(createServerMarketingTraceReadRepository).mockResolvedValue({
      listRecentTraces: async () => [],
      getTrace: async () => ({
        contract: MARKETING_TRACE_CONTRACT,
        traceId,
        traceType: "marketing_production",
        status: "completed",
        startedAt: "2026-09-10T08:00:00.000Z",
        endedAt: "2026-09-10T08:00:10.000Z",
        productionRequestId: "obs3-smoke-pr-1",
      }),
      listTraceSpans: async () => [
        {
          contract: MARKETING_SPAN_CONTRACT,
          spanId,
          traceId,
          parentSpanId: null,
          name: "marketing.production",
          kind: "orchestration",
          actorType: "system",
          actorId: null,
          stage: "production_request",
          attempt: 1,
          status: "ok",
          otelStatusCode: "OK",
          startedAt: "2026-09-10T08:00:00.000Z",
          endedAt: "2026-09-10T08:00:10.000Z",
          durationMs: 10000,
          attributes: { "marketing.fixture": "obs3_durable_smoke" },
          error: null,
        },
      ],
      findTraceByProductionRequestId: async () => null,
    } as never);

    const res = await getTrace(new Request("http://localhost/x"), {
      params: Promise.resolve({ traceId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trace.traceId).toBe(traceId);
    expect(body.spans).toHaveLength(1);
    expect(body.spans[0].attributes["marketing.fixture"]).toBe("obs3_durable_smoke");
  });
});
