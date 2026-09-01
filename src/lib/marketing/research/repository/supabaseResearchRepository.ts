import "server-only";

import type { ResearchDbClient } from "@/lib/marketing/research/repository/dbClient";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import {
  ResearchIdempotencyConflictError,
  ResearchRepositoryError,
} from "@/lib/marketing/research/repository/errors";
import {
  mapAgendaCandidateRow,
  mapResearchBriefRow,
  mapResearchEvidenceRow,
  mapResearchSignalRow,
  mapResearchSourceRow,
  toAgendaCandidateRow,
  toResearchBriefRow,
  toResearchEvidenceRow,
  toResearchSignalRow,
  toResearchSourceRow,
} from "@/lib/marketing/research/repository/mappers";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { ResearchEvidence, ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

function throwDb(error: { message: string; code?: string } | null, fallback: string): never {
  if (error?.code === "23505") {
    throw new ResearchIdempotencyConflictError("duplicate");
  }
  throw new ResearchRepositoryError("db_error", error?.message || fallback);
}

function asRow(data: unknown): Record<string, unknown> {
  if (typeof data !== "object" || data == null || Array.isArray(data)) {
    throw new ResearchRepositoryError("db_error", "expected single row");
  }
  return data as Record<string, unknown>;
}

function asRows(data: unknown): Record<string, unknown>[] {
  if (data == null) return [];
  if (!Array.isArray(data)) {
    throw new ResearchRepositoryError("db_error", "expected row array");
  }
  return data as Record<string, unknown>[];
}

export class SupabaseResearchRepository implements ResearchRepository {
  constructor(private readonly client: ResearchDbClient) {}

  async getSourceById(id: string): Promise<ResearchSource | null> {
    const { data, error } = await this.client
      .from("research_sources")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throwDb(error, "getSourceById failed");
    return data ? mapResearchSourceRow(asRow(data)) : null;
  }

  async listEnabledSources(): Promise<ResearchSource[]> {
    const { data, error } = await this.client
      .from("research_sources")
      .select("*")
      .eq("is_enabled", true);
    if (error) throwDb(error, "listEnabledSources failed");
    return asRows(data).map(mapResearchSourceRow);
  }

  async upsertSource(source: ResearchSource): Promise<ResearchSource> {
    const row = toResearchSourceRow({
      ...source,
      updatedAt: new Date().toISOString(),
    });
    const { data, error } = await this.client
      .from("research_sources")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throwDb(error, "upsertSource failed");
    return mapResearchSourceRow(asRow(data));
  }

  private async loadEvidenceForSignal(signalId: string): Promise<ResearchEvidence[]> {
    const { data, error } = await this.client
      .from("research_evidence")
      .select("*")
      .eq("signal_id", signalId);
    if (error) throwDb(error, "loadEvidenceForSignal failed");
    return asRows(data).map(mapResearchEvidenceRow);
  }

  private async persistEvidence(signal: ResearchSignal): Promise<void> {
    const { error: deleteError } = await this.client
      .from("research_evidence")
      .delete()
      .eq("signal_id", signal.id);
    if (deleteError) throwDb(deleteError, "delete evidence failed");

    if (signal.evidence.length === 0) return;

    const rows = signal.evidence.map((evidence) => toResearchEvidenceRow(evidence, signal.id));
    const { error } = await this.client.from("research_evidence").insert(rows);
    if (error) throwDb(error, "insert evidence failed");
  }

  private async insertSignal(signal: ResearchSignal): Promise<ResearchSignal> {
    const { data, error } = await this.client
      .from("research_signals")
      .insert(toResearchSignalRow(signal))
      .select("*")
      .single();
    if (error) throwDb(error, "insertSignal failed");
    await this.persistEvidence(signal);
    const evidence = await this.loadEvidenceForSignal(signal.id);
    return mapResearchSignalRow(asRow(data), evidence);
  }

  private async updateSignal(signal: ResearchSignal): Promise<ResearchSignal> {
    const { data, error } = await this.client
      .from("research_signals")
      .update(toResearchSignalRow(signal))
      .eq("id", signal.id)
      .select("*")
      .single();
    if (error) throwDb(error, "updateSignal failed");
    await this.persistEvidence(signal);
    const evidence = await this.loadEvidenceForSignal(signal.id);
    return mapResearchSignalRow(asRow(data), evidence);
  }

  async upsertSignal(signal: ResearchSignal): Promise<ResearchSignal> {
    const existingByFingerprint = await this.findByFingerprint(signal.rawFingerprint);
    if (existingByFingerprint && existingByFingerprint.id !== signal.id) {
      const merged: ResearchSignal = {
        ...existingByFingerprint,
        ...signal,
        id: existingByFingerprint.id,
        createdAt: existingByFingerprint.createdAt,
        observedAt: signal.observedAt,
        updatedAt: new Date().toISOString(),
        evidence: mergeEvidence(existingByFingerprint.evidence, signal.evidence),
      };
      return this.updateSignal(merged);
    }

    const existingById = await this.findSignalById(signal.id);
    if (existingById) {
      return this.updateSignal({
        ...existingById,
        ...signal,
        updatedAt: new Date().toISOString(),
        evidence: mergeEvidence(existingById.evidence, signal.evidence),
      });
    }

    return this.insertSignal(signal);
  }

  async findSignalById(id: string): Promise<ResearchSignal | null> {
    const { data, error } = await this.client
      .from("research_signals")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throwDb(error, "findSignalById failed");
    if (!data) return null;
    const evidence = await this.loadEvidenceForSignal(id);
    return mapResearchSignalRow(asRow(data), evidence);
  }

  async findByFingerprint(fingerprint: string): Promise<ResearchSignal | null> {
    const { data, error } = await this.client
      .from("research_signals")
      .select("*")
      .eq("raw_fingerprint", fingerprint)
      .maybeSingle();
    if (error) throwDb(error, "findByFingerprint raw failed");
    let row = data;
    if (!row) {
      const normalized = await this.client
        .from("research_signals")
        .select("*")
        .eq("normalized_fingerprint", fingerprint)
        .maybeSingle();
      if (normalized.error) throwDb(normalized.error, "findByFingerprint normalized failed");
      row = normalized.data;
    }
    if (!row) return null;
    const mapped = asRow(row);
    const evidence = await this.loadEvidenceForSignal(asString(mapped.id));
    return mapResearchSignalRow(mapped, evidence);
  }

  async findRecentSignals(input: {
    since: string;
    limit?: number;
  }): Promise<ResearchSignal[]> {
    const { data, error } = await this.client
      .from("research_signals")
      .select("*")
      .gte("observed_at", input.since)
      .order("observed_at", { ascending: false })
      .limit(input.limit ?? 100);
    if (error) throwDb(error, "findRecentSignals failed");
    const rows = asRows(data);
    return Promise.all(
      rows.map(async (row) => {
        const evidence = await this.loadEvidenceForSignal(asString(row.id));
        return mapResearchSignalRow(row, evidence);
      }),
    );
  }

  async findEligibleSignals(input?: { limit?: number }): Promise<ResearchSignal[]> {
    const { data, error } = await this.client
      .from("research_signals")
      .select("*")
      .eq("status", "eligible")
      .order("observed_at", { ascending: false })
      .limit(input?.limit ?? 100);
    if (error) throwDb(error, "findEligibleSignals failed");
    const rows = asRows(data);
    return Promise.all(
      rows.map(async (row) => {
        const evidence = await this.loadEvidenceForSignal(asString(row.id));
        return mapResearchSignalRow(row, evidence);
      }),
    );
  }

  async findSignalsByTopic(topic: string, limit = 50): Promise<ResearchSignal[]> {
    const { data, error } = await this.client
      .from("research_signals")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(limit * 3);
    if (error) throwDb(error, "findSignalsByTopic failed");
    const needle = topic.toLowerCase();
    const rows = asRows(data).filter((row) =>
      asStringArray(row.topics).some((t) => t.toLowerCase().includes(needle)),
    );
    return Promise.all(
      rows.slice(0, limit).map(async (row) => {
        const evidence = await this.loadEvidenceForSignal(asString(row.id));
        return mapResearchSignalRow(row, evidence);
      }),
    );
  }

  async findSignalsByDestination(destination: string, limit = 50): Promise<ResearchSignal[]> {
    const { data, error } = await this.client
      .from("research_signals")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(limit * 3);
    if (error) throwDb(error, "findSignalsByDestination failed");
    const needle = destination.toLowerCase();
    const rows = asRows(data).filter((row) =>
      asStringArray(row.destinations).some((d) => d.toLowerCase() === needle),
    );
    return Promise.all(
      rows.slice(0, limit).map(async (row) => {
        const evidence = await this.loadEvidenceForSignal(asString(row.id));
        return mapResearchSignalRow(row, evidence);
      }),
    );
  }

  async upsertBrief(brief: ResearchBrief): Promise<ResearchBrief> {
    const existing = await this.findBriefById(brief.id);
    const row = toResearchBriefRow(brief);
    const write = existing
      ? this.client.from("research_briefs").update(row).eq("id", brief.id).select("*").single()
      : this.client.from("research_briefs").insert(row).select("*").single();
    const { data, error } = await write;
    if (error) throwDb(error, "upsertBrief failed");

    await this.client.from("research_brief_signals").delete().eq("brief_id", brief.id);
    if (brief.signalIds.length > 0) {
      const joinRows = brief.signalIds.map((signalId) => ({
        brief_id: brief.id,
        signal_id: signalId,
      }));
      const { error: joinError } = await this.client
        .from("research_brief_signals")
        .insert(joinRows);
      if (joinError) throwDb(joinError, "upsertBrief join failed");
    }

    return mapResearchBriefRow(asRow(data), brief.signalIds, brief.evidence);
  }

  async findBriefById(id: string): Promise<ResearchBrief | null> {
    const { data, error } = await this.client
      .from("research_briefs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throwDb(error, "findBriefById failed");
    if (!data) return null;

    const { data: joinData, error: joinError } = await this.client
      .from("research_brief_signals")
      .select("signal_id")
      .eq("brief_id", id);
    if (joinError) throwDb(joinError, "findBriefById join failed");
    const signalIds = asRows(joinData).map((row) => asString(row.signal_id));

    const evidence: ResearchEvidence[] = [];
    for (const signalId of signalIds) {
      evidence.push(...(await this.loadEvidenceForSignal(signalId)));
    }

    return mapResearchBriefRow(asRow(data), signalIds, dedupeEvidence(evidence));
  }

  async findActiveBriefs(limit = 50): Promise<ResearchBrief[]> {
    const { data, error } = await this.client
      .from("research_briefs")
      .select("*")
      .eq("status", "active")
      .order("generated_at", { ascending: false })
      .limit(limit);
    if (error) throwDb(error, "findActiveBriefs failed");
    const rows = asRows(data);
    return Promise.all(
      rows.map(async (row) => {
        const id = asString(row.id);
        const brief = await this.findBriefById(id);
        if (!brief) {
          throw new ResearchRepositoryError("db_error", `brief ${id} missing after select`);
        }
        return brief;
      }),
    );
  }

  async upsertAgendaCandidate(candidate: AgendaCandidate): Promise<AgendaCandidate> {
    const existing = await this.findAgendaCandidateById(candidate.id);
    const row = toAgendaCandidateRow(candidate);
    const write = existing
      ? this.client
          .from("agenda_candidates")
          .update(row)
          .eq("id", candidate.id)
          .select("*")
          .single()
      : this.client.from("agenda_candidates").insert(row).select("*").single();
    const { data, error } = await write;
    if (error) throwDb(error, "upsertAgendaCandidate failed");
    return mapAgendaCandidateRow(asRow(data));
  }

  async findAgendaCandidateById(id: string): Promise<AgendaCandidate | null> {
    const { data, error } = await this.client
      .from("agenda_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throwDb(error, "findAgendaCandidateById failed");
    return data ? mapAgendaCandidateRow(asRow(data)) : null;
  }

  async findRecentAgendaCandidates(input: {
    since: string;
    limit?: number;
  }): Promise<AgendaCandidate[]> {
    const { data, error } = await this.client
      .from("agenda_candidates")
      .select("*")
      .gte("created_at", input.since)
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 100);
    if (error) throwDb(error, "findRecentAgendaCandidates failed");
    return asRows(data).map(mapAgendaCandidateRow);
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mergeEvidence(existing: ResearchEvidence[], incoming: ResearchEvidence[]): ResearchEvidence[] {
  const byId = new Map<string, ResearchEvidence>();
  for (const row of [...existing, ...incoming]) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

function dedupeEvidence(rows: ResearchEvidence[]): ResearchEvidence[] {
  const byId = new Map<string, ResearchEvidence>();
  for (const row of rows) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}
