import type {
  MarketingTraceDetailDto,
  MarketingTraceListItemDto,
} from "@/lib/marketing/observability/viewer/dto";
import { diffSpanDeltas, diffTraceListDeltas } from "@/lib/marketing/observability/viewer/live/merge";
import type {
  MarketingTraceLiveFetchers,
  MarketingTraceLiveTransport,
  MarketingTraceLiveTransportHandlers,
} from "@/lib/marketing/observability/viewer/live/types";

export type PollingMarketingTraceLiveTransportOptions = {
  fetchers: MarketingTraceLiveFetchers;
  handlers: MarketingTraceLiveTransportHandlers;
  /** Active interval when any RUNNING trace exists or selected is running. Default 2000. */
  activeIntervalMs?: number;
  /** Idle recent-list interval. Default 15000. */
  idleIntervalMs?: number;
  /** Optional clock for tests. */
  now?: () => number;
  /** Optional setTimeout/clearTimeout for tests. */
  schedule?: {
    setInterval: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
    clearInterval: (id: ReturnType<typeof setInterval>) => void;
  };
};

/**
 * Incremental polling transport (OBS-5 path C).
 * Reuses authenticated admin REST — no service-role in browser, no RLS open.
 * Contract is transport-swappable later (Realtime/SSE) without UI rewrite.
 */
export function createPollingMarketingTraceLiveTransport(
  options: PollingMarketingTraceLiveTransportOptions,
): MarketingTraceLiveTransport {
  const activeMs = options.activeIntervalMs ?? 2_000;
  const idleMs = options.idleIntervalMs ?? 15_000;
  const sched = options.schedule ?? {
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id),
  };

  let stopped = true;
  let selectedTraceId: string | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let consecutiveFailures = 0;
  let lastList: MarketingTraceListItemDto[] = [];
  let lastDetail: MarketingTraceDetailDto | null = null;
  let currentInterval = idleMs;

  const emitConnection = (state: "live" | "connecting" | "reconnecting" | "offline") => {
    options.handlers.onConnectionState(state);
  };

  const hasActiveWork = () => {
    if (lastDetail?.trace.status === "running" && lastDetail.trace.traceId === selectedTraceId) {
      return true;
    }
    return lastList.some((t) => t.status === "running");
  };

  const desiredInterval = () => (hasActiveWork() ? activeMs : idleMs);

  const clearTimer = () => {
    if (timer != null) {
      sched.clearInterval(timer);
      timer = null;
    }
  };

  const armTimer = () => {
    if (stopped) return;
    const next = desiredInterval();
    if (timer != null && next === currentInterval) return;
    clearTimer();
    currentInterval = next;
    timer = sched.setInterval(() => {
      void tick();
    }, currentInterval);
  };

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      if (consecutiveFailures > 0) {
        emitConnection("reconnecting");
      }
      await pull({ silent: consecutiveFailures === 0 });
      consecutiveFailures = 0;
      emitConnection("live");
      armTimer();
    } catch (err) {
      consecutiveFailures += 1;
      options.handlers.onError?.(err);
      emitConnection(consecutiveFailures >= 3 ? "offline" : "reconnecting");
    } finally {
      inFlight = false;
    }
  };

  const pull = async (_opts?: { silent?: boolean }) => {
    const eventAt = new Date(options.now?.() ?? Date.now()).toISOString();
    const traces = await options.fetchers.fetchRecentTraces();
    const listDeltas = diffTraceListDeltas(lastList, traces, eventAt);
    lastList = traces;
    options.handlers.onDelta({ eventType: "list_synced", eventAt, traces });
    for (const d of listDeltas) {
      options.handlers.onDelta(d);
    }

    if (selectedTraceId) {
      const detail = await options.fetchers.fetchTraceDetail(selectedTraceId);
      const prevSpans = lastDetail?.trace.traceId === selectedTraceId ? lastDetail.spans : [];
      const spanDeltas = diffSpanDeltas(selectedTraceId, prevSpans, detail.spans, eventAt);
      lastDetail = detail;
      options.handlers.onDelta({
        eventType: "detail_synced",
        traceId: selectedTraceId,
        eventAt,
        detail,
      });
      for (const d of spanDeltas) {
        options.handlers.onDelta(d);
      }
    }
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      consecutiveFailures = 0;
      emitConnection("connecting");
      void tick();
    },
    stop() {
      stopped = true;
      clearTimer();
    },
    setSelectedTraceId(traceId) {
      selectedTraceId = traceId;
      if (!stopped && traceId) {
        void tick();
      } else {
        armTimer();
      }
    },
    async resync() {
      if (stopped) return;
      emitConnection("reconnecting");
      consecutiveFailures = 0;
      try {
        await pull();
        emitConnection("live");
        armTimer();
      } catch (err) {
        consecutiveFailures += 1;
        options.handlers.onError?.(err);
        emitConnection("offline");
        throw err;
      }
    },
  };
}

export async function defaultAdminTraceFetchers(): Promise<{
  fetchRecentTraces: () => Promise<MarketingTraceListItemDto[]>;
  fetchTraceDetail: (traceId: string) => Promise<MarketingTraceDetailDto>;
}> {
  return {
    async fetchRecentTraces() {
      const res = await fetch("/api/admin/marketing-observability/traces?limit=30", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`list_failed_${res.status}`);
      const body = (await res.json()) as { traces: MarketingTraceListItemDto[] };
      return body.traces ?? [];
    },
    async fetchTraceDetail(traceId: string) {
      const res = await fetch(
        `/api/admin/marketing-observability/traces/${encodeURIComponent(traceId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`detail_failed_${res.status}`);
      return (await res.json()) as MarketingTraceDetailDto;
    },
  };
}
