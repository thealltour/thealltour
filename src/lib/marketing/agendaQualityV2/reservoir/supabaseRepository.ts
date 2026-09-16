/**
 * Additive Supabase-backed Agenda Reservoir V2.
 * Table: marketing_agenda_reservoir_v2 (JSONB candidate payload).
 */

import type {
  AgendaReservoirItem,
  AgendaReservoirListFilter,
  DurableAgendaReservoirRepository,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import { assertAgendaReservoirShadowPayload } from "@/lib/marketing/agendaQualityV2/reservoir/types";

type DbClient = {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    upsert: (row: unknown, options?: { onConflict?: string }) => unknown;
  };
};

function asRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data as Record<string, unknown>[];
}

function mapRow(row: Record<string, unknown>): AgendaReservoirItem {
  return row.payload as AgendaReservoirItem;
}

function toRow(item: AgendaReservoirItem): Record<string, unknown> {
  return {
    agenda_id: item.agendaId,
    lifecycle_status: item.status,
    freshness_class: item.freshnessClass,
    expires_at: item.expiresAt,
    source_fingerprint: item.sourceFingerprint,
    topic_fingerprint: item.topicFingerprint,
    decision_axis_fingerprint: item.decisionAxisFingerprint,
    story_seed_fingerprint: item.storySeedFingerprint,
    semantic_fingerprint: item.semanticFingerprint,
    first_qualified_at: item.firstQualifiedAt,
    last_presented_at: item.lastPresentedAt,
    presented_count: item.presentedCount,
    selected_at: item.selectedAt,
    deferred_at: item.deferredAt,
    rejected_at: item.rejectedAt,
    expired_at: item.expiredAt,
    superseded_by_agenda_id: item.supersededByAgendaId,
    first_seen_at: item.firstSeenAt,
    last_seen_at: item.lastSeenAt,
    seen_count: item.seenCount,
    last_slate_at: item.lastSlateAt,
    last_selected_at: item.lastSelectedAt,
    last_rejected_at: item.lastRejectedAt,
    candidate_version: item.candidateVersion,
    payload: item,
    updated_at: new Date().toISOString(),
  };
}

export class SupabaseAgendaReservoirRepository implements DurableAgendaReservoirRepository {
  constructor(private readonly client: DbClient) {}

  async get(agendaId: string): Promise<AgendaReservoirItem | null> {
    const query = this.client.from("marketing_agenda_reservoir_v2").select("*") as {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    const { data, error } = await query.eq("agenda_id", agendaId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object") return null;
    return mapRow(data as Record<string, unknown>);
  }

  async upsert(item: AgendaReservoirItem): Promise<void> {
    assertAgendaReservoirShadowPayload(item);
    const query = this.client.from("marketing_agenda_reservoir_v2").upsert(toRow(item), {
      onConflict: "agenda_id",
    }) as {
      select: () => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await query.select();
    if (error) throw new Error(error.message);
  }

  async list(filter?: AgendaReservoirListFilter): Promise<AgendaReservoirItem[]> {
    let query = this.client.from("marketing_agenda_reservoir_v2").select("*") as {
      eq: (col: string, val: string) => typeof query;
      gte: (col: string, val: string) => typeof query;
      in: (col: string, vals: string[]) => typeof query;
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };

    if (filter?.topicFingerprint) {
      query = query.eq("topic_fingerprint", filter.topicFingerprint) as typeof query;
    }
    if (filter?.decisionAxisFingerprint) {
      query = query.eq(
        "decision_axis_fingerprint",
        filter.decisionAxisFingerprint,
      ) as typeof query;
    }
    if (filter?.sinceIso) {
      query = query.gte("last_seen_at", filter.sinceIso) as typeof query;
    }
    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      query = query.in("lifecycle_status", statuses) as typeof query;
    }

    const { data, error } = await query.order("last_seen_at", { ascending: false });
    if (error) throw new Error(error.message);
    return asRows(data).map(mapRow);
  }

  async listRecent(params?: { sinceIso?: string; limit?: number }): Promise<AgendaReservoirItem[]> {
    const rows = await this.list(params?.sinceIso ? { sinceIso: params.sinceIso } : undefined);
    return rows.slice(0, params?.limit ?? 200);
  }
}
