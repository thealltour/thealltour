import type { MarketingSpan, MarketingTrace } from "@/lib/marketing/observability/types";
import type { MarketingTraceStore } from "@/lib/marketing/observability/persistence/store";
import { rowToSpan, rowToTrace } from "@/lib/marketing/observability/persistence/types";

export type MarketingTraceReadRepository = {
  getTrace(traceId: string): Promise<MarketingTrace | null>;
  listTraceSpans(traceId: string): Promise<MarketingSpan[]>;
  findTraceByProductionRequestId(productionRequestId: string): Promise<MarketingTrace | null>;
  listRecentTraces(input?: {
    limit?: number;
    status?: string | null;
  }): Promise<MarketingTrace[]>;
};

export function createMarketingTraceReadRepository(
  store: MarketingTraceStore,
): MarketingTraceReadRepository {
  return {
    async getTrace(traceId) {
      const row = await store.getTraceRow(traceId);
      if (!row) return null;
      const spans = await store.listSpanRows(traceId);
      return rowToTrace(
        row,
        spans.map(rowToSpan),
      );
    },

    async listTraceSpans(traceId) {
      const spans = await store.listSpanRows(traceId);
      return spans.map(rowToSpan);
    },

    async findTraceByProductionRequestId(productionRequestId) {
      const row = await store.findTraceRowByProductionRequestId(productionRequestId);
      if (!row) return null;
      const spans = await store.listSpanRows(row.trace_id);
      return rowToTrace(row, spans.map(rowToSpan));
    },

    async listRecentTraces(input) {
      const rows = await store.listRecentTraceRows(input);
      return rows.map((row) => rowToTrace(row));
    },
  };
}
