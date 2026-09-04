import "server-only";

import type { DailyAgendaSlateRepository } from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import type { DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";

type DbClient = {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    upsert: (row: unknown, options?: { onConflict?: string }) => unknown;
    update: (row: unknown) => unknown;
  };
};

function asRow(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("expected single row");
  }
  return data as Record<string, unknown>;
}

function mapSlate(row: Record<string, unknown>): DailyAgendaSlate {
  return row.payload as DailyAgendaSlate;
}

export class SupabaseDailyAgendaSlateRepository implements DailyAgendaSlateRepository {
  constructor(private readonly client: DbClient) {}

  async findByLogicalKey(logicalRunKey: string): Promise<DailyAgendaSlate | null> {
    const query = this.client.from("daily_marketing_agenda_slates").select("*") as {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    const { data, error } = await query.eq("logical_run_key", logicalRunKey).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSlate(asRow(data)) : null;
  }

  async findByBusinessDate(businessDateKst: string): Promise<DailyAgendaSlate | null> {
    const query = this.client.from("daily_marketing_agenda_slates").select("*") as {
      eq: (col: string, val: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => {
            maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
          };
        };
      };
    };
    const { data, error } = await query
      .eq("business_date_kst", businessDateKst)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSlate(asRow(data)) : null;
  }

  async listRecent(options: { limit?: number; beforeBusinessDateKst?: string } = {}): Promise<DailyAgendaSlate[]> {
    const limit = options.limit ?? 14;
    let query = this.client.from("daily_marketing_agenda_slates").select("*") as {
      lt: (col: string, val: string) => typeof query;
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => { limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
    };
    if (options.beforeBusinessDateKst) {
      query = query.lt("business_date_kst", options.beforeBusinessDateKst) as typeof query;
    }
    const { data, error } = await query.order("business_date_kst", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapSlate(asRow(row)));
  }

  async saveSlate(slate: DailyAgendaSlate): Promise<DailyAgendaSlate> {
    const existing = await this.findByLogicalKey(slate.logicalRunKey);
    if (existing) return existing;
    const row = {
      logical_run_key: slate.logicalRunKey,
      slate_id: slate.slateId,
      run_id: slate.runId,
      business_date_kst: slate.businessDateKst,
      routine_id: slate.routineId,
      status: slate.status,
      payload: slate,
      updated_at: slate.updatedAt,
    };
    const upsert = this.client.from("daily_marketing_agenda_slates").upsert(row, {
      onConflict: "logical_run_key",
    }) as {
      select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    const { data, error } = await upsert.select("*").single();
    if (error) throw new Error(error.message);
    return mapSlate(asRow(data));
  }

  async updateSlate(slate: DailyAgendaSlate): Promise<DailyAgendaSlate> {
    const existing = await this.findByLogicalKey(slate.logicalRunKey);
    if (!existing) throw new Error(`slate not found: ${slate.logicalRunKey}`);
    const update = this.client.from("daily_marketing_agenda_slates").update({
      status: slate.status,
      payload: slate,
      updated_at: slate.updatedAt,
    }) as {
      eq: (col: string, val: string) => {
        select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    };
    const { data, error } = await update.eq("logical_run_key", slate.logicalRunKey).select("*").single();
    if (error) throw new Error(error.message);
    return mapSlate(asRow(data));
  }
}
