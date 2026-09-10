import type {
  MarketingSpanDto,
  MarketingTraceDetailDto,
  MarketingTraceListItemDto,
} from "@/lib/marketing/observability/viewer/dto";

/**
 * Transport-agnostic connection state for the marketing observability live UI.
 * UI must distinguish "no data" from "transport offline".
 */
export type MarketingTraceLiveConnectionState =
  | "live"
  | "connecting"
  | "reconnecting"
  | "offline";

export type MarketingTraceLiveEventType =
  | "trace_inserted"
  | "trace_updated"
  | "span_inserted"
  | "span_updated"
  | "detail_synced"
  | "list_synced";

/**
 * Delta notification — always carries safe viewer DTOs (same privacy boundary as OBS-4).
 * Full DB rows are never forwarded to the browser.
 */
export type MarketingTraceLiveDelta =
  | {
      eventType: "trace_inserted" | "trace_updated";
      traceId: string;
      eventAt: string;
      trace: MarketingTraceListItemDto;
    }
  | {
      eventType: "span_inserted" | "span_updated";
      traceId: string;
      spanId: string;
      eventAt: string;
      span: MarketingSpanDto;
    }
  | {
      eventType: "list_synced";
      eventAt: string;
      traces: MarketingTraceListItemDto[];
    }
  | {
      eventType: "detail_synced";
      traceId: string;
      eventAt: string;
      detail: MarketingTraceDetailDto;
    };

export type MarketingTraceLiveTransportHandlers = {
  onConnectionState: (state: MarketingTraceLiveConnectionState) => void;
  onDelta: (delta: MarketingTraceLiveDelta) => void;
  onError?: (error: unknown) => void;
};

/**
 * Thin abstraction so the UI does not depend on polling vs Realtime vs SSE.
 * Source of truth remains the authenticated REST/DB read path.
 */
export type MarketingTraceLiveTransport = {
  start: () => void;
  stop: () => void;
  /** Selected trace for detail subscription / faster poll. */
  setSelectedTraceId: (traceId: string | null) => void;
  /** Force DB resync (reconnect recovery). */
  resync: () => Promise<void>;
};

export type MarketingTraceLiveFetchers = {
  fetchRecentTraces: () => Promise<MarketingTraceListItemDto[]>;
  fetchTraceDetail: (traceId: string) => Promise<MarketingTraceDetailDto>;
};
