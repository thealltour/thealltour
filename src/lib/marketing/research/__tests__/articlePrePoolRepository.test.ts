import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { signalFixture } from "@/lib/marketing/research/__tests__/semanticCalibrationFixtures";
import { MVP_RESEARCH_SOURCES } from "@/lib/marketing/research/collectors/config";
import {
  agendaCandidateArticleIdentity,
  collectUniqueArticleAgendaCandidates,
} from "@/lib/marketing/research/manager/collectUniqueArticleAgendaCandidates";
import type {
  AgendaCandidateArticleRef,
  ResearchRepository,
} from "@/lib/marketing/research/repository/contracts";
import type {
  ResearchDbClient,
  ResearchDbQuery,
  ResearchDbResult,
} from "@/lib/marketing/research/repository/dbClient";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { toAgendaCandidateRow } from "@/lib/marketing/research/repository/mappers";
import { SupabaseResearchRepository } from "@/lib/marketing/research/repository/supabaseResearchRepository";
import { buildAgendaCandidateFromBrief } from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { buildResearchBriefFromCluster } from "@/lib/marketing/research/services/briefBuilder";
import type { AgendaCandidate } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const NOW = new Date("2026-09-02T12:00:00.000Z");
const SINCE = new Date(NOW.getTime() - 168 * 3600_000).toISOString();
const SOURCES: ResearchSource[] = MVP_RESEARCH_SOURCES.map((s) => ({
  ...s,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
}));
const SOURCE_ID = SOURCES[0]!.id;

function uuid(group: number, n: number): string {
  return `${group.toString(16).padStart(8, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3600_000).toISOString();
}

type RowSpec = {
  row: number;
  /** Rows sharing an article reuse one signal (production: brief/candidate re-inserted per cycle). */
  article: number;
  url: string | null;
  score: number;
  createdAt?: string;
};

/** Seeds signal → brief → candidate rows into the in-memory repo; returns candidates by row. */
async function seedInMemory(specs: RowSpec[]) {
  const repo = createInMemoryResearchRepository(SOURCES);
  const sources = new Map(SOURCES.map((s) => [s.id, s]));
  const byRow = new Map<number, AgendaCandidate>();
  for (const spec of specs) {
    const signal = signalFixture({
      id: uuid(1, spec.article),
      title: `Article ${spec.article}`,
      summary: `Summary for article ${spec.article}.`,
      signalType: "general_travel_news",
      sourceId: SOURCE_ID,
      canonicalUrl: spec.url,
      rawFingerprint: `article-${spec.article}`,
      normalizedFingerprint: `article-${spec.article}-n`,
    });
    const stored = await repo.upsertSignal(signal);
    const brief = buildResearchBriefFromCluster({
      cluster: {
        id: uuid(2, spec.row),
        primarySignalId: stored.id,
        signalIds: [stored.id],
        clusterType: "destination_group",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
      signals: [stored],
      sources,
      now: NOW,
    })!;
    await repo.upsertBrief(brief);
    const candidate: AgendaCandidate = {
      ...buildAgendaCandidateFromBrief(brief, NOW),
      id: uuid(3, spec.row),
      compositeResearchScore: spec.score,
      createdAt: spec.createdAt ?? hoursAgo(1),
      updatedAt: spec.createdAt ?? hoursAgo(1),
    };
    await repo.upsertAgendaCandidate(candidate);
    byRow.set(spec.row, candidate);
  }
  return { repo, byRow };
}

/** Minimal paging repo for identity/pagination tests; refs are supplied directly. */
function fakePagingRepo(
  rows: Array<{ id: string; score: number; createdAt?: string; title?: string }>,
  refs: Record<string, AgendaCandidateArticleRef | undefined>,
) {
  const pageCalls: Array<{ limit: number; offset: number }> = [];
  const candidates = rows.map(
    (r) =>
      ({
        id: r.id,
        researchBriefId: `brief-${r.id}`,
        title: r.title ?? `title ${r.id}`,
        compositeResearchScore: r.score,
        createdAt: r.createdAt ?? hoursAgo(1),
      }) as AgendaCandidate,
  );
  const repo = {
    async findRecentAgendaCandidates() {
      throw new Error("legacy read must not be used when paging is available");
    },
    async findRecentAgendaCandidatesPage(input: { since: string; limit: number; offset: number }) {
      pageCalls.push({ limit: input.limit, offset: input.offset });
      return candidates.slice(input.offset, input.offset + input.limit);
    },
    async findAgendaCandidateArticleRefs(page: Array<Pick<AgendaCandidate, "id">>) {
      const out = new Map<string, AgendaCandidateArticleRef>();
      for (const c of page) {
        const ref = refs[c.id];
        if (ref) out.set(c.id, ref);
      }
      return out;
    },
  } as unknown as ResearchRepository;
  return { repo, pageCalls };
}

function urlRef(url: string | null, signalId: string | null = null): AgendaCandidateArticleRef {
  return { canonicalUrl: url, signalId, sourceId: SOURCE_ID };
}

describe("agendaCandidateArticleIdentity", () => {
  it("uses normalized canonical URL first and ignores tracking params / hash", () => {
    const a = agendaCandidateArticleIdentity(
      { id: "a", title: "x" },
      urlRef("https://Example.com/news/1?utm_source=rss&fbclid=abc#top", "sig-a"),
    );
    const b = agendaCandidateArticleIdentity(
      { id: "b", title: "y" },
      urlRef("https://example.com/news/1/?gclid=zzz", "sig-b"),
    );
    expect(a).toBe(b);
    expect(a.startsWith("url:")).toBe(true);
  });

  it("falls back to signal id, then title+source, then candidate id — never bare title", () => {
    expect(agendaCandidateArticleIdentity({ id: "a", title: "T" }, urlRef(null, "sig-1"))).toBe(
      "signal:sig-1",
    );
    expect(
      agendaCandidateArticleIdentity(
        { id: "a", title: "  Same   Title " },
        { canonicalUrl: null, signalId: null, sourceId: "src-1" },
      ),
    ).toBe("title_source:src-1|same title");
    expect(agendaCandidateArticleIdentity({ id: "a", title: "Same Title" }, undefined)).toBe(
      "candidate:a",
    );
    expect(agendaCandidateArticleIdentity({ id: "b", title: "Same Title" }, undefined)).toBe(
      "candidate:b",
    );
  });
});

describe("collectUniqueArticleAgendaCandidates", () => {
  it("collapses multiple rows of the same URL into one", async () => {
    const { repo } = fakePagingRepo(
      [
        { id: "r1", score: 0.9 },
        { id: "r2", score: 0.8 },
        { id: "r3", score: 0.7 },
      ],
      {
        r1: urlRef("https://news.example/a", "s1"),
        r2: urlRef("https://news.example/a", "s1"),
        r3: urlRef("https://news.example/a", "s1"),
      },
    );
    const { candidates, diagnostics } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 10,
    });
    expect(candidates.map((c) => c.id)).toEqual(["r1"]);
    expect(diagnostics.duplicateRowsDropped).toBe(2);
    expect(diagnostics.uniqueArticleCandidates).toBe(1);
    expect(diagnostics.fetchedCandidateRows).toBe(3);
  });

  it("treats URLs differing only by tracking params as one article", async () => {
    const { repo } = fakePagingRepo(
      [
        { id: "r1", score: 0.9 },
        { id: "r2", score: 0.8 },
      ],
      {
        r1: urlRef("https://news.example/a?utm_campaign=x", "s1"),
        r2: urlRef("https://news.example/a?fbclid=y#frag", "s2"),
      },
    );
    const { candidates } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 10,
    });
    expect(candidates.map((c) => c.id)).toEqual(["r1"]);
  });

  it("keeps every distinct URL", async () => {
    const { repo } = fakePagingRepo(
      [
        { id: "r1", score: 0.9 },
        { id: "r2", score: 0.8 },
        { id: "r3", score: 0.7 },
      ],
      {
        r1: urlRef("https://news.example/a", "s1"),
        r2: urlRef("https://news.example/b", "s2"),
        r3: urlRef("https://other.example/a", "s3"),
      },
    );
    const { candidates, diagnostics } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 10,
    });
    expect(candidates.map((c) => c.id)).toEqual(["r1", "r2", "r3"]);
    expect(diagnostics.duplicateRowsDropped).toBe(0);
  });

  it("does not collapse distinct URL-less articles, even with identical titles", async () => {
    const { repo } = fakePagingRepo(
      [
        { id: "r1", score: 0.9, title: "Travel update" },
        { id: "r2", score: 0.8, title: "Travel update" },
        { id: "r3", score: 0.7, title: "Travel update" },
        { id: "r4", score: 0.6, title: "Travel update" },
      ],
      {
        r1: urlRef(null, "s1"),
        r2: urlRef(null, "s2"),
        // r3, r4: no brief/signal resolved → candidate id identity
      },
    );
    const { candidates } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 10,
    });
    expect(candidates.map((c) => c.id)).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("reads the next page when the first page is entirely duplicates", async () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, score: 1 - i * 0.01 }));
    const refs: Record<string, AgendaCandidateArticleRef> = {};
    rows.forEach((r, i) => {
      refs[r.id] = i < 4 ? urlRef("https://dup.example/a", "s-dup") : urlRef(`https://u.example/${i}`, `s${i}`);
    });
    const { repo, pageCalls } = fakePagingRepo(rows, refs);
    const { candidates, diagnostics } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 3,
      pageSize: 3,
    });
    expect(candidates.map((c) => c.id)).toEqual(["r0", "r4", "r5"]);
    expect(pageCalls).toEqual([
      { limit: 3, offset: 0 },
      { limit: 3, offset: 3 },
    ]);
    expect(diagnostics.pagesRead).toBe(2);
    expect(diagnostics.duplicateRowsDropped).toBe(3);
    expect(diagnostics.lookbackExhausted).toBe(false);
  });

  it("returns all unique articles when fewer than the target exist", async () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, score: 1 - i * 0.01 }));
    const refs: Record<string, AgendaCandidateArticleRef> = {};
    rows.forEach((r, i) => {
      refs[r.id] = urlRef(`https://u.example/${i % 4}`, `s${i % 4}`);
    });
    const { repo } = fakePagingRepo(rows, refs);
    const { candidates, diagnostics } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 180,
      pageSize: 3,
    });
    expect(candidates).toHaveLength(4);
    expect(diagnostics.lookbackExhausted).toBe(true);
    expect(diagnostics.maxPagesReached).toBe(false);
  });

  it("returns exactly the target when more unique articles exist", async () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ id: `r${i}`, score: 1 - i * 0.001 }));
    const refs: Record<string, AgendaCandidateArticleRef> = {};
    rows.forEach((r, i) => {
      refs[r.id] = urlRef(`https://u.example/${i}`, `s${i}`);
    });
    const { repo } = fakePagingRepo(rows, refs);
    const { candidates, diagnostics } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 180,
    });
    expect(candidates).toHaveLength(180);
    expect(diagnostics.uniqueArticleCandidates).toBe(180);
    expect(diagnostics.pagesRead).toBe(1);
  });

  it("stops at the max-page guard and reports it", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, score: 1 - i * 0.01 }));
    const refs: Record<string, AgendaCandidateArticleRef> = {};
    rows.forEach((r) => {
      refs[r.id] = urlRef("https://dup.example/a", "s-dup");
    });
    const { repo } = fakePagingRepo(rows, refs);
    const { candidates, diagnostics } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 5,
      pageSize: 2,
      maxPages: 3,
    });
    expect(candidates).toHaveLength(1);
    expect(diagnostics.pagesRead).toBe(3);
    expect(diagnostics.maxPagesReached).toBe(true);
  });

  it("falls back to the legacy row-limited read when paging is unavailable", async () => {
    const legacy = vi.fn(async () => [] as AgendaCandidate[]);
    const repo = { findRecentAgendaCandidates: legacy } as unknown as ResearchRepository;
    const { diagnostics } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 180,
    });
    expect(legacy).toHaveBeenCalledWith({ since: SINCE, limit: 180 });
    expect(diagnostics.mode).toBe("legacy_row_limit");
  });
});

describe("collectUniqueArticleAgendaCandidates with InMemoryResearchRepository", () => {
  it("keeps the highest-score row of a duplicated article", async () => {
    const { repo, byRow } = await seedInMemory([
      { row: 1, article: 1, url: "https://news.example/a", score: 0.4 },
      { row: 2, article: 1, url: "https://news.example/a", score: 0.9 },
      { row: 3, article: 1, url: "https://news.example/a", score: 0.6 },
    ]);
    const { candidates } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 10,
    });
    expect(candidates.map((c) => c.id)).toEqual([byRow.get(2)!.id]);
  });

  it("keeps the newest row when duplicate rows tie on score", async () => {
    const { repo, byRow } = await seedInMemory([
      { row: 1, article: 1, url: "https://news.example/a", score: 0.7, createdAt: hoursAgo(30) },
      { row: 2, article: 1, url: "https://news.example/a", score: 0.7, createdAt: hoursAgo(2) },
      { row: 3, article: 1, url: "https://news.example/a", score: 0.7, createdAt: hoursAgo(12) },
    ]);
    const { candidates } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 10,
    });
    expect(candidates.map((c) => c.id)).toEqual([byRow.get(2)!.id]);
  });

  it("preserves composite score order across pages and honours the lookback", async () => {
    const { repo, byRow } = await seedInMemory([
      { row: 1, article: 1, url: "https://a.example/1", score: 0.5 },
      { row: 2, article: 2, url: "https://a.example/2", score: 0.95 },
      { row: 3, article: 1, url: "https://a.example/1", score: 0.85 },
      { row: 4, article: 3, url: "https://a.example/3", score: 0.7 },
      { row: 5, article: 4, url: "https://a.example/4", score: 0.99, createdAt: hoursAgo(169) },
      { row: 6, article: 5, url: "https://a.example/5", score: 0.6 },
    ]);
    const { candidates, diagnostics } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 10,
      pageSize: 2,
    });
    expect(candidates.map((c) => c.id)).toEqual(
      [2, 3, 4, 6].map((row) => byRow.get(row)!.id),
    );
    const scores = candidates.map((c) => c.compositeResearchScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(candidates.some((c) => c.id === byRow.get(5)!.id)).toBe(false);
    expect(diagnostics.duplicateRowsDropped).toBe(1);
  });

  it("resolves article refs through brief → primary signal", async () => {
    const { repo, byRow } = await seedInMemory([
      { row: 1, article: 7, url: "https://news.example/x", score: 0.5 },
    ]);
    const refs = await repo.findAgendaCandidateArticleRefs([byRow.get(1)!]);
    expect(refs.get(byRow.get(1)!.id)).toEqual({
      signalId: uuid(1, 7),
      canonicalUrl: "https://news.example/x",
      sourceId: SOURCE_ID,
    });
  });
});

type Row = Record<string, unknown>;
type DbOp = { table: string; op: string; args: unknown[] };

/** Read-focused fake PostgREST client: multi-column order, range, in, gte; records every call. */
class RecordingResearchDb {
  tables = new Map<string, Row[]>();
  ops: DbOp[] = [];

  client(): ResearchDbClient {
    return { from: (table: string) => this.query(table) };
  }

  writes(): DbOp[] {
    return this.ops.filter((o) => ["insert", "update", "upsert", "delete"].includes(o.op));
  }

  private query(table: string): ResearchDbQuery {
    const state: {
      filters: Array<(row: Row) => boolean>;
      orders: Array<{ column: string; ascending: boolean }>;
      from?: number;
      to?: number;
      limit?: number;
    } = { filters: [], orders: [] };
    const record = (op: string, ...args: unknown[]) => this.ops.push({ table, op, args });

    const exec = async (): Promise<ResearchDbResult> => {
      let list = [...(this.tables.get(table) ?? [])].filter((row) =>
        state.filters.every((f) => f(row)),
      );
      list.sort((a, b) => {
        for (const { column, ascending } of state.orders) {
          const av = a[column];
          const bv = b[column];
          const cmp =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av ?? "").localeCompare(String(bv ?? ""));
          if (cmp !== 0) return ascending ? cmp : -cmp;
        }
        return 0;
      });
      if (state.from != null && state.to != null) list = list.slice(state.from, state.to + 1);
      else if (state.limit != null) list = list.slice(0, state.limit);
      return { data: list, error: null };
    };

    const builder: ResearchDbQuery = {
      select(cols) {
        record("select", cols);
        return builder;
      },
      insert(values) {
        record("insert", values);
        return builder;
      },
      update(values) {
        record("update", values);
        return builder;
      },
      upsert(values) {
        record("upsert", values);
        return builder;
      },
      delete() {
        record("delete");
        return builder;
      },
      eq(column, value) {
        record("eq", column, value);
        state.filters.push((row) => row[column] === value);
        return builder;
      },
      in(column, values) {
        record("in", column, values);
        state.filters.push((row) => values.includes(row[column]));
        return builder;
      },
      gte(column, value) {
        record("gte", column, value);
        state.filters.push((row) => String(row[column] ?? "") >= value);
        return builder;
      },
      order(column, options) {
        record("order", column, options);
        state.orders.push({ column, ascending: options?.ascending ?? true });
        return builder;
      },
      limit(count) {
        record("limit", count);
        state.limit = count;
        return builder;
      },
      range(from, to) {
        record("range", from, to);
        state.from = from;
        state.to = to;
        return builder;
      },
      maybeSingle: () => exec(),
      single: () => exec(),
      then: (resolve, reject) => exec().then(resolve, reject),
    };
    return builder;
  }
}

function seedSupabaseRows(db: RecordingResearchDb, specs: RowSpec[]) {
  const candidates: Row[] = [];
  const briefs: Row[] = [];
  const signals = new Map<string, Row>();
  const template = buildAgendaCandidateFromBrief(
    buildResearchBriefFromCluster({
      cluster: {
        id: uuid(9, 0),
        primarySignalId: uuid(1, 0),
        signalIds: [uuid(1, 0)],
        clusterType: "destination_group",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
      signals: [
        signalFixture({
          id: uuid(1, 0),
          title: "Template",
          summary: "Template summary.",
          signalType: "general_travel_news",
          sourceId: SOURCE_ID,
        }),
      ],
      sources: new Map(SOURCES.map((s) => [s.id, s])),
      now: NOW,
    })!,
    NOW,
  );
  for (const spec of specs) {
    const signalId = uuid(1, spec.article);
    const briefId = uuid(2, spec.row);
    signals.set(signalId, { id: signalId, source_id: SOURCE_ID, canonical_url: spec.url });
    briefs.push({ id: briefId, primary_signal_id: signalId });
    candidates.push(
      toAgendaCandidateRow({
        ...template,
        id: uuid(3, spec.row),
        researchBriefId: briefId,
        title: `Article ${spec.article}`,
        compositeResearchScore: spec.score,
        createdAt: spec.createdAt ?? hoursAgo(1),
        updatedAt: spec.createdAt ?? hoursAgo(1),
      }),
    );
  }
  db.tables.set("agenda_candidates", candidates);
  db.tables.set("research_briefs", briefs);
  db.tables.set("research_signals", [...signals.values()]);
}

describe("SupabaseResearchRepository article pre-pool reads", () => {
  it("pages with composite DESC, created_at DESC, id DESC and range offsets", async () => {
    const db = new RecordingResearchDb();
    seedSupabaseRows(db, [
      { row: 1, article: 1, url: "https://a.example/1", score: 0.7, createdAt: hoursAgo(5) },
      { row: 2, article: 2, url: "https://a.example/2", score: 0.7, createdAt: hoursAgo(5) },
      { row: 3, article: 3, url: "https://a.example/3", score: 0.9 },
      { row: 4, article: 4, url: "https://a.example/4", score: 0.7, createdAt: hoursAgo(2) },
    ]);
    const repo = new SupabaseResearchRepository(db.client());

    const first = await repo.findRecentAgendaCandidatesPage({ since: SINCE, limit: 2, offset: 0 });
    const second = await repo.findRecentAgendaCandidatesPage({ since: SINCE, limit: 2, offset: 2 });
    expect([...first, ...second].map((c) => c.id)).toEqual([
      uuid(3, 3),
      uuid(3, 4),
      uuid(3, 2),
      uuid(3, 1),
    ]);
    const orders = db.ops.filter((o) => o.op === "order").slice(0, 3).map((o) => o.args);
    expect(orders).toEqual([
      ["composite_research_score", { ascending: false }],
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(db.ops.filter((o) => o.op === "range").map((o) => o.args)).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(db.ops.find((o) => o.op === "gte")?.args).toEqual(["created_at", SINCE]);
  });

  it("resolves article refs in chunked brief/signal lookups", async () => {
    const db = new RecordingResearchDb();
    const specs: RowSpec[] = Array.from({ length: 170 }, (_, i) => ({
      row: i + 1,
      article: (i % 85) + 1,
      url: `https://a.example/${(i % 85) + 1}`,
      score: 0.5,
    }));
    seedSupabaseRows(db, specs);
    const repo = new SupabaseResearchRepository(db.client());
    const page = await repo.findRecentAgendaCandidatesPage({ since: SINCE, limit: 250, offset: 0 });
    const refs = await repo.findAgendaCandidateArticleRefs(page);

    expect(refs.size).toBe(170);
    expect(refs.get(uuid(3, 86))).toEqual({
      signalId: uuid(1, 1),
      canonicalUrl: "https://a.example/1",
      sourceId: SOURCE_ID,
    });
    const inCalls = db.ops.filter((o) => o.op === "in");
    expect(inCalls.every((o) => (o.args[1] as unknown[]).length <= 80)).toBe(true);
    expect(inCalls.filter((o) => o.table === "research_briefs")).toHaveLength(3);
    expect(inCalls.filter((o) => o.table === "research_signals")).toHaveLength(2);
  });

  it("builds the unique-article pre-pool without any DB writes", async () => {
    const db = new RecordingResearchDb();
    const specs: RowSpec[] = [];
    for (let i = 0; i < 600; i += 1) {
      specs.push({
        row: i + 1,
        article: (i % 200) + 1,
        url: `https://a.example/${(i % 200) + 1}?utm_source=feed${i}`,
        score: 1 - (i % 200) * 0.001,
        createdAt: hoursAgo(1 + Math.floor(i / 200)),
      });
    }
    seedSupabaseRows(db, specs);
    const repo = new SupabaseResearchRepository(db.client());
    const { candidates, diagnostics } = await collectUniqueArticleAgendaCandidates(repo, {
      since: SINCE,
      targetUniqueArticles: 180,
    });

    expect(candidates).toHaveLength(180);
    expect(new Set(candidates.map((c) => c.title)).size).toBe(180);
    expect(diagnostics.mode).toBe("unique_article_pages");
    expect(diagnostics.pagesRead).toBe(3);
    expect(diagnostics.duplicateRowsDropped).toBeGreaterThan(0);
    expect(db.writes()).toEqual([]);
    expect(db.tables.get("agenda_candidates")).toHaveLength(600);
  });
});
