import "server-only";

import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { CompletedMarketingCandidate, DailyMarketingRun } from "@/lib/marketing/cron/daily/types";

type DbClient = {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    upsert: (row: unknown, options?: { onConflict?: string }) => unknown;
  };
};

function asRow(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("expected single row");
  }
  return data as Record<string, unknown>;
}

function mapRun(row: Record<string, unknown>): DailyMarketingRun {
  return row.payload as DailyMarketingRun;
}

function mapCandidate(row: Record<string, unknown>): CompletedMarketingCandidate {
  return row.payload as CompletedMarketingCandidate;
}

export class SupabaseDailyMarketingRunRepository implements DailyMarketingRunRepository {
  constructor(private readonly client: DbClient) {}

  async findRunByLogicalKey(logicalRunKey: string): Promise<DailyMarketingRun | null> {
    const query = this.client.from("daily_marketing_runs").select("*") as {
      eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    const { data, error } = await query.eq("logical_run_key", logicalRunKey).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRun(asRow(data)) : null;
  }

  async findCandidateByLogicalKey(logicalRunKey: string): Promise<CompletedMarketingCandidate | null> {
    const query = this.client.from("completed_marketing_candidates").select("*") as {
      eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    const { data, error } = await query.eq("logical_run_key", logicalRunKey).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapCandidate(asRow(data)) : null;
  }

  async findCandidateByCandidateId(candidateId: string): Promise<CompletedMarketingCandidate | null> {
    const query = this.client.from("completed_marketing_candidates").select("*") as {
      eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    const { data, error } = await query.eq("candidate_id", candidateId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapCandidate(asRow(data)) : null;
  }

  async listCandidates(options: { limit?: number; businessDateKst?: string } = {}): Promise<CompletedMarketingCandidate[]> {
    const limit = options.limit ?? 50;
    let query = this.client.from("completed_marketing_candidates").select("*") as {
      eq: (col: string, val: string) => unknown;
      order: (col: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
    };
    if (options.businessDateKst) {
      query = (query as { eq: (col: string, val: string) => typeof query }).eq(
        "business_date_kst",
        options.businessDateKst,
      ) as typeof query;
    }
    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapCandidate(asRow(row)));
  }

  async saveRun(run: DailyMarketingRun): Promise<DailyMarketingRun> {
    const existing = await this.findRunByLogicalKey(run.logicalRunKey);
    if (existing?.status === "completed" && existing.completedCandidateId) {
      return existing;
    }
    const row = {
      logical_run_key: run.logicalRunKey,
      run_id: run.runId,
      business_date_kst: run.businessDateKst,
      routine_id: run.routineId,
      correlation_id: run.correlationId,
      status: run.status,
      payload: run,
    };
    const upsert = this.client.from("daily_marketing_runs").upsert(row, { onConflict: "logical_run_key" }) as {
      select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    const { data, error } = await upsert.select("*").single();
    if (error) throw new Error(error.message);
    return mapRun(asRow(data));
  }

  async saveCandidate(candidate: CompletedMarketingCandidate): Promise<CompletedMarketingCandidate> {
    const existing = await this.findCandidateByLogicalKey(candidate.logicalRunKey);
    if (existing) return existing;
    const row = {
      logical_run_key: candidate.logicalRunKey,
      candidate_id: candidate.candidateId,
      run_id: candidate.runId,
      business_date_kst: candidate.businessDateKst,
      status: candidate.status,
      payload: candidate,
    };
    const upsert = this.client.from("completed_marketing_candidates").upsert(row, { onConflict: "logical_run_key" }) as {
      select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    const { data, error } = await upsert.select("*").single();
    if (error) throw new Error(error.message);
    return mapCandidate(asRow(data));
  }
}
