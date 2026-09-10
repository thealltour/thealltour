import type { MarketingSpanAttributes } from "@/lib/marketing/observability/types";
import type {
  MarketingSpanRow,
  MarketingTraceRow,
} from "@/lib/marketing/observability/persistence/types";

/** Loose Supabase/Postgrest client — same pattern as AI Runtime observability. */
export type MarketingObsDbResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

export type MarketingObsDbQuery = {
  select(columns?: string): MarketingObsDbQuery;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): MarketingObsDbQuery;
  update(values: Record<string, unknown>): MarketingObsDbQuery;
  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ): MarketingObsDbQuery;
  eq(column: string, value: unknown): MarketingObsDbQuery;
  gte(column: string, value: unknown): MarketingObsDbQuery;
  lt(column: string, value: unknown): MarketingObsDbQuery;
  in(column: string, values: unknown[]): MarketingObsDbQuery;
  order(column: string, options?: { ascending?: boolean }): MarketingObsDbQuery;
  limit(count: number): MarketingObsDbQuery;
  maybeSingle(): PromiseLike<MarketingObsDbResult>;
  then: PromiseLike<MarketingObsDbResult>["then"];
};

export type MarketingObsDbClient = {
  from(table: string): MarketingObsDbQuery;
};

export type MarketingTraceStore = {
  upsertTrace(row: MarketingTraceRow): Promise<void>;
  updateTrace(
    traceId: string,
    patch: Partial<MarketingTraceRow> & { updated_at?: string },
  ): Promise<void>;
  upsertSpan(row: MarketingSpanRow): Promise<void>;
  updateSpan(
    traceId: string,
    spanId: string,
    patch: Partial<MarketingSpanRow> & { updated_at?: string },
  ): Promise<void>;
  getTraceRow(traceId: string): Promise<MarketingTraceRow | null>;
  getSpanRow(traceId: string, spanId: string): Promise<MarketingSpanRow | null>;
  listSpanRows(traceId: string): Promise<MarketingSpanRow[]>;
  findTraceRowByProductionRequestId(productionRequestId: string): Promise<MarketingTraceRow | null>;
  listRecentTraceRows(input?: {
    limit?: number;
    status?: string | null;
  }): Promise<MarketingTraceRow[]>;
};

export type TraceCorrelationPatch = {
  production_request_id?: string | null;
  logical_run_key?: string | null;
  agenda_slate_id?: string | null;
  agenda_candidate_id?: string | null;
  assignment_id?: string | null;
  completed_candidate_id?: string | null;
  hmr_id?: string | null;
  run_id?: string | null;
  correlation_id?: string | null;
  research_brief_id?: string | null;
  governance_review_id?: string | null;
  business_date_kst?: string | null;
  root_span_id?: string | null;
  attributes?: MarketingSpanAttributes;
};
