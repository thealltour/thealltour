"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  MarketingTraceDetailDto,
  MarketingTraceListItemDto,
} from "@/lib/marketing/observability/viewer/dto";
import {
  applyLiveDelta,
  createPollingMarketingTraceLiveTransport,
  defaultAdminTraceFetchers,
  type MarketingTraceLiveConnectionState,
  type MarketingTraceLiveDelta,
  type MarketingTraceLiveTransport,
} from "@/lib/marketing/observability/viewer/live";

type UseMarketingTraceLiveArgs = {
  initialTraces: MarketingTraceListItemDto[];
  selectedTraceId: string | null;
  /** When false, transport is not started (e.g. tests). Default true. */
  enabled?: boolean;
  /** Inject transport (tests). */
  createTransport?: (args: {
    onConnectionState: (s: MarketingTraceLiveConnectionState) => void;
    onDelta: (d: MarketingTraceLiveDelta) => void;
  }) => MarketingTraceLiveTransport;
};

/**
 * Live layer for marketing observability admin page.
 * Historical REST remains source of truth; transport delivers fast notifications + resync.
 */
export function useMarketingTraceLive({
  initialTraces,
  selectedTraceId,
  enabled = true,
  createTransport,
}: UseMarketingTraceLiveArgs) {
  const [live, setLive] = useState<{
    traces: MarketingTraceListItemDto[];
    detail: MarketingTraceDetailDto | null;
  }>({ traces: initialTraces, detail: null });
  const [connectionState, setConnectionState] =
    useState<MarketingTraceLiveConnectionState>("connecting");
  const selectedRef = useRef(selectedTraceId);
  selectedRef.current = selectedTraceId;
  const transportRef = useRef<MarketingTraceLiveTransport | null>(null);

  const applyDeltaSafe = useCallback((delta: MarketingTraceLiveDelta) => {
    setLive((prev) =>
      applyLiveDelta(
        {
          traces: prev.traces,
          detail: prev.detail,
          selectedTraceId: selectedRef.current,
        },
        delta,
      ),
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const boot = async () => {
      const handlers = {
        onConnectionState: (s: MarketingTraceLiveConnectionState) => {
          if (!cancelled) setConnectionState(s);
        },
        onDelta: (d: MarketingTraceLiveDelta) => {
          if (!cancelled) applyDeltaSafe(d);
        },
      };

      const transport = createTransport
        ? createTransport(handlers)
        : createPollingMarketingTraceLiveTransport({
            fetchers: await defaultAdminTraceFetchers(),
            handlers,
          });

      if (cancelled) {
        transport.stop();
        return;
      }
      transportRef.current = transport;
      transport.setSelectedTraceId(selectedRef.current);
      transport.start();
    };

    void boot();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void transportRef.current?.resync().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      transportRef.current?.stop();
      transportRef.current = null;
    };
  }, [enabled, createTransport, applyDeltaSafe]);

  useEffect(() => {
    transportRef.current?.setSelectedTraceId(selectedTraceId);
    // Drop mismatched detail immediately so the tree does not flash the previous run.
    setLive((prev) => {
      if (!selectedTraceId) return { ...prev, detail: null };
      if (prev.detail && prev.detail.trace.traceId !== selectedTraceId) {
        return { ...prev, detail: null };
      }
      return prev;
    });
  }, [selectedTraceId]);

  const resync = useCallback(async () => {
    await transportRef.current?.resync();
  }, []);

  const setDetail = useCallback((next: MarketingTraceDetailDto | null) => {
    setLive((prev) => ({ ...prev, detail: next }));
  }, []);

  const setTraces = useCallback((next: MarketingTraceListItemDto[]) => {
    setLive((prev) => ({ ...prev, traces: next }));
  }, []);

  return {
    traces: live.traces,
    setTraces,
    detail: live.detail,
    setDetail,
    connectionState,
    resync,
  };
}
