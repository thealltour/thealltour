import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { randomUUID } from "node:crypto";

import { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
import { enrichResearchSignal } from "@/lib/marketing/research/services/enrichSignal";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import { buildResearchBriefFromSignals } from "@/lib/marketing/research/services/briefBuilder";
import { buildAgendaCandidateFromBrief } from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { MVP_RESEARCH_SOURCES } from "@/lib/marketing/research/collectors/config";
import type { ResearchDbClient, ResearchDbQuery, ResearchDbResult } from "@/lib/marketing/research/repository/dbClient";
import { SupabaseResearchRepository } from "@/lib/marketing/research/repository/supabaseResearchRepository";
import { mapResearchSourceRow } from "@/lib/marketing/research/repository/mappers";

const NOW = new Date("2026-09-02T00:00:00.000Z");

type Row = Record<string, unknown>;

class MockResearchDb {
  sources = new Map<string, Row>();
  signals = new Map<string, Row>();
  evidence = new Map<string, Row>();
  briefs = new Map<string, Row>();
  briefSignals = new Map<string, Row>();
  candidates = new Map<string, Row>();

  client(): ResearchDbClient {
    return { from: (table: string) => this.query(table) };
  }

  private query(table: string): ResearchDbQuery {
    const state: {
      filters: Array<{ op: "eq" | "gte"; column: string; value: unknown }>;
      orderBy?: { column: string; ascending: boolean };
      limit?: number;
      pendingWrite?: { kind: "insert" | "update" | "upsert" | "delete"; values: Row | Row[] };
      selectCols?: string;
      singleMode?: "none" | "maybe" | "one";
    } = { filters: [], singleMode: "none" };

    const exec = async (): Promise<ResearchDbResult> => {
      const rows = this.rowsFor(table);
      let list = [...rows.values()];

      for (const filter of state.filters) {
        if (filter.op === "eq") {
          list = list.filter((row) => row[filter.column] === filter.value);
        }
        if (filter.op === "gte") {
          list = list.filter((row) => String(row[filter.column] ?? "") >= String(filter.value));
        }
      }

      if (state.orderBy) {
        const { column, ascending } = state.orderBy;
        list.sort((a, b) => {
          const av = String(a[column] ?? "");
          const bv = String(b[column] ?? "");
          return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (state.limit != null) {
        list = list.slice(0, state.limit);
      }

      if (state.pendingWrite?.kind === "delete") {
        for (const row of list) {
          rows.delete(String(row.id ?? `${row.brief_id}:${row.signal_id}`));
        }
        return { data: null, error: null };
      }

      if (state.pendingWrite?.kind === "insert") {
        const values = Array.isArray(state.pendingWrite.values)
          ? state.pendingWrite.values
          : [state.pendingWrite.values];
        for (const value of values) {
          const id = String(value.id ?? `${value.brief_id}:${value.signal_id}`);
          rows.set(id, { ...value });
        }
        const single = values.length === 1 ? values[0] : values;
        return { data: single, error: null };
      }

      if (state.pendingWrite?.kind === "update") {
        const value = state.pendingWrite.values as Row;
        const id = String(state.filters.find((f) => f.column === "id")?.value ?? value.id);
        rows.set(id, { ...rows.get(id), ...value, id });
        return { data: rows.get(id), error: null };
      }

      if (state.pendingWrite?.kind === "upsert") {
        const value = state.pendingWrite.values as Row;
        rows.set(String(value.id), { ...value });
        return { data: value, error: null };
      }

      if (state.selectCols === "signal_id") {
        return { data: list, error: null };
      }

      if (list.length === 0) {
        return { data: state.singleMode === "none" ? [] : null, error: null };
      }
      if (state.singleMode === "none") {
        return { data: list, error: null };
      }
      return { data: list[0], error: null };
    };

    const builder: ResearchDbQuery = {
      select(cols?: string) {
        state.selectCols = cols;
        return builder;
      },
      insert(values) {
        state.pendingWrite = { kind: "insert", values: values as Row | Row[] };
        return builder;
      },
      update(values) {
        state.pendingWrite = { kind: "update", values: values as Row };
        return builder;
      },
      upsert(values) {
        state.pendingWrite = { kind: "upsert", values: values as Row };
        return builder;
      },
      delete() {
        state.pendingWrite = { kind: "delete", values: {} };
        return builder;
      },
      eq(column, value) {
        state.filters.push({ op: "eq", column, value });
        return builder;
      },
      in() {
        return builder;
      },
      gte(column, value) {
        state.filters.push({ op: "gte", column, value });
        return builder;
      },
      order(column, options) {
        state.orderBy = { column, ascending: options?.ascending ?? true };
        return builder;
      },
      limit(count) {
        state.limit = count;
        return builder;
      },
      maybeSingle() {
        state.singleMode = "maybe";
        return exec();
      },
      single() {
        state.singleMode = "one";
        return exec();
      },
      then: (resolve, reject) => exec().then(resolve, reject),
    };

    return builder;
  }

  private rowsFor(table: string): Map<string, Row> {
    switch (table) {
      case "research_sources":
        return this.sources;
      case "research_signals":
        return this.signals;
      case "research_evidence":
        return this.evidence;
      case "research_briefs":
        return this.briefs;
      case "research_brief_signals":
        return this.briefSignals;
      case "agenda_candidates":
        return this.candidates;
      default:
        throw new Error(`unknown table ${table}`);
    }
  }
}

describe("SupabaseResearchRepository", () => {
  it("round-trips source, signal, evidence, brief, agenda candidate", async () => {
    const db = new MockResearchDb();
    const repo = new SupabaseResearchRepository(db.client());
    const sources = await bootstrapResearchSources(repo, NOW);
    const source = sources[0]!;

    const raw = {
      sourceId: source.id,
      sourceType: source.sourceType,
      signalType: "entry_requirement" as const,
      title: "Japan travel advisory",
      summary: "Updated official travel guidance for Japan.",
      claim: "Updated official travel guidance for Japan.",
      claimSource: "source" as const,
      evidence: [
        {
          id: randomUUID(),
          sourceId: source.id,
          url: "https://www.gov.uk/foreign-travel-advice/japan",
          excerpt: "Updated official travel guidance for Japan.",
          observedAt: NOW.toISOString(),
          evidenceType: "official_statement" as const,
        },
      ],
      canonicalUrl: "https://www.gov.uk/foreign-travel-advice/japan",
      externalId: "gov-japan",
      geography: [],
      destinations: ["japan"],
      topics: ["travel", "visa"],
      entities: [],
      language: "en",
      observedAt: NOW.toISOString(),
      metadata: null,
    };

    const normalized = normalizeResearchSignal(raw, source, NOW);
    expect(normalized.ok).toBe(true);
    const enriched = enrichResearchSignal(normalized.signal, source, NOW);
    const persisted = await repo.upsertSignal(enriched);
    expect(persisted.evidence[0]?.url).toContain("gov.uk");

    const loaded = await repo.findSignalById(persisted.id);
    expect(loaded?.evidence).toHaveLength(1);

    const brief = buildResearchBriefFromSignals([{ ...enriched, status: "eligible" }], NOW)!;
    await repo.upsertBrief(brief);
    const loadedBrief = await repo.findBriefById(brief.id);
    expect(loadedBrief?.evidence).toHaveLength(1);

    const candidate = buildAgendaCandidateFromBrief(brief, NOW);
    await repo.upsertAgendaCandidate(candidate);
    const loadedCandidate = await repo.findAgendaCandidateById(candidate.id);
    expect(loadedCandidate?.status).toBe("candidate");
  });

  it("rejects malformed DB source row", () => {
    expect(() =>
      mapResearchSourceRow({
        id: "11111111-1111-4111-8111-111111111111",
        source_type: "news",
        name: "",
        is_official: false,
        is_enabled: true,
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
      }),
    ).toThrow();
  });

  it("does not persist credential-like fields in mapper guard", () => {
    expect(() =>
      mapResearchSourceRow({
        id: randomUUID(),
        source_type: "news",
        name: "bad",
        is_official: false,
        is_enabled: true,
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
        metadata: { access_token: "secret" },
      }),
    ).toThrow(/forbidden credential-like field/);
  });

  it("finds signal by fingerprint idempotently", async () => {
    const db = new MockResearchDb();
    const repo = new SupabaseResearchRepository(db.client());
    const [source] = await bootstrapResearchSources(repo, NOW);

    const raw = {
      sourceId: source!.id,
      sourceType: source!.sourceType,
      signalType: "general_travel_news" as const,
      title: "Spain travel tips",
      summary: "Practical Spain travel planning tips from source feed.",
      claim: "Practical Spain travel planning tips from source feed.",
      claimSource: "source" as const,
      evidence: [
        {
          id: randomUUID(),
          sourceId: source!.id,
          url: "https://example.com/spain",
          excerpt: "Practical Spain travel planning tips from source feed.",
          observedAt: NOW.toISOString(),
          evidenceType: "direct_source" as const,
        },
      ],
      geography: [],
      destinations: ["spain"],
      topics: ["travel"],
      entities: [],
      language: "en",
      observedAt: NOW.toISOString(),
      metadata: null,
    };

    const normalized = normalizeResearchSignal(raw, source!, NOW);
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    const first = enrichResearchSignal(normalized.signal, source!, NOW);
    await repo.upsertSignal(first);
    const again = await repo.upsertSignal({
      ...first,
      observedAt: new Date("2026-09-02T02:00:00.000Z").toISOString(),
    });
    expect(again.id).toBe(first.id);
  });
});
