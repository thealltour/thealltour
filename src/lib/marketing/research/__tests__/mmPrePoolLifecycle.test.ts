import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ResearchSourceLifecycleStatus } from "@/lib/marketing/research";
import { signalFixture } from "@/lib/marketing/research/__tests__/semanticCalibrationFixtures";
import {
  PARITY_FIXTURE_BY_FEED,
  mockFeedFetch,
} from "@/lib/marketing/research/__tests__/sourceRegistryParityFixtures";
import { runResearchCollectionCycle } from "@/lib/marketing/research/collection/runResearchCollectionCycle";
import {
  NYT_TRAVEL_SOURCE,
  RESEARCH_SOURCE_REGISTRY,
  UK_GOV_TRAVEL_SOURCE,
  createDefaultResearchCollectors,
  projectResearchSource,
  type ResearchSourceDefinition,
} from "@/lib/marketing/research/collectors";
import {
  collectUniqueArticleAgendaCandidates,
  type AgendaCandidateEligibility,
} from "@/lib/marketing/research/manager/collectUniqueArticleAgendaCandidates";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import { createMmSourceLifecycleEligibility } from "@/lib/marketing/research/manager/mmSourceLifecycleEligibility";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import {
  createInMemoryResearchRepository,
  type InMemoryResearchRepository,
} from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { buildAgendaCandidateFromBrief } from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { buildResearchBriefFromCluster } from "@/lib/marketing/research/services/briefBuilder";
import type { AgendaCandidate } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const NOW = new Date("2026-10-01T09:00:00.000Z");
const ISO = NOW.toISOString();
const EPOCH = "1970-01-01T00:00:00.000Z";
const SINCE = new Date(NOW.getTime() - 168 * 3600_000).toISOString();
const NON_ACTIVE = ["shadow", "paused", "retired"] as const;
const ACTIVE_DEF = UK_GOV_TRAVEL_SOURCE;
const TOGGLED_DEF = NYT_TRAVEL_SOURCE;

afterEach(() => {
  vi.restoreAllMocks();
});

function sourceRow(definition: ResearchSourceDefinition, status?: ResearchSourceLifecycleStatus): ResearchSource {
  const clone = structuredClone(definition);
  if (status) clone.semantics.lifecycle = { status };
  return { ...projectResearchSource(clone), createdAt: ISO, updatedAt: ISO };
}

async function runMm(repo: ResearchRepository, limit = 30) {
  return getMarketingManagerResearchContext(
    { lookbackHours: 168, limit },
    { repo, now: NOW, checkSemanticInfrastructure: async () => false },
  );
}

/** Runs MM while capturing the `article_prepool` log event. */
async function runMmWithPrePoolLog(repo: ResearchRepository, limit = 30) {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const mm = await runMm(repo, limit);
  const events = info.mock.calls
    .filter(([tag]) => tag === "[mm-research-context]")
    .map(([, payload]) => JSON.parse(String(payload)) as Record<string, unknown>)
    .filter((event) => event.event === "article_prepool");
  info.mockRestore();
  expect(events).toHaveLength(1);
  return { mm, prePoolLog: events[0]! };
}

async function allCandidates(repo: ResearchRepository): Promise<AgendaCandidate[]> {
  return repo.findRecentAgendaCandidatesPage!({ since: EPOCH, limit: 100_000, offset: 0 });
}

/** Test-side primary-source resolution, independent of the production predicate. */
async function primarySourceIdOf(repo: ResearchRepository, candidate: AgendaCandidate): Promise<string | null> {
  const brief = await repo.findBriefById(candidate.researchBriefId);
  if (!brief) return null;
  const signalId = brief.primarySignalId ?? brief.signalIds[0] ?? null;
  const signal = signalId ? await repo.findSignalById(signalId) : null;
  return signal?.sourceId ?? brief.evidence[0]?.sourceId ?? null;
}

async function prePool(
  repo: ResearchRepository,
  options: { target?: number; pageSize?: number; eligibility?: AgendaCandidateEligibility | null } = {},
) {
  return collectUniqueArticleAgendaCandidates(repo, {
    since: SINCE,
    targetUniqueArticles: options.target ?? 300,
    pageSize: options.pageSize,
    isCandidateEligible:
      options.eligibility === null ? undefined : (options.eligibility ?? createMmSourceLifecycleEligibility(repo)),
  });
}

/** Legacy (non-paging) view of a repository. */
function legacyView(repo: InMemoryResearchRepository): ResearchRepository {
  return {
    findRecentAgendaCandidates: repo.findRecentAgendaCandidates.bind(repo),
    findBriefById: repo.findBriefById.bind(repo),
    findSignalById: repo.findSignalById.bind(repo),
    getSourceById: repo.getSourceById.bind(repo),
  } as unknown as ResearchRepository;
}

/** Same repository, overriding selected methods. */
function withOverrides(repo: ResearchRepository, overrides: Partial<ResearchRepository>): ResearchRepository {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      if (prop in overrides) return overrides[prop as keyof ResearchRepository];
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

// ---------------------------------------------------------------------------
// Cycle-fed universe: one seeded state copied into A (lifecycle) and B (rows removed).
// ---------------------------------------------------------------------------

async function seededCycleRepo() {
  const repo = createInMemoryResearchRepository();
  await runResearchCollectionCycle({
    repo,
    now: NOW,
    env: { RESEARCH_COLLECTION_ENABLED: "true" },
    sources: RESEARCH_SOURCE_REGISTRY,
    collectors: createDefaultResearchCollectors(
      { fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) },
      RESEARCH_SOURCE_REGISTRY,
    ),
  });
  return repo;
}

async function cloneRepo(
  src: InMemoryResearchRepository,
  keepCandidate: (candidate: AgendaCandidate) => Promise<boolean> | boolean = () => true,
) {
  const sources: ResearchSource[] = [];
  for (const definition of RESEARCH_SOURCE_REGISTRY) {
    const row = await src.getSourceById(definition.id);
    if (row) sources.push(structuredClone(row));
  }
  const dst = createInMemoryResearchRepository(sources);
  for (const signal of await src.findRecentSignals({ since: EPOCH, limit: 100_000 })) {
    await dst.upsertSignal(structuredClone(signal));
  }
  const candidates = await allCandidates(src);
  for (const candidate of candidates) {
    const brief = await src.findBriefById(candidate.researchBriefId);
    if (brief) await dst.upsertBrief(structuredClone(brief));
  }
  for (const candidate of candidates) {
    if (await keepCandidate(candidate)) await dst.upsertAgendaCandidate(structuredClone(candidate));
  }
  return dst;
}

async function lifecycleAB(status: ResearchSourceLifecycleStatus) {
  const seeded = await seededCycleRepo();
  const a = await cloneRepo(seeded);
  await a.upsertSource(sourceRow(TOGGLED_DEF, status));
  const b = await cloneRepo(seeded, async (c) => (await primarySourceIdOf(seeded, c)) !== TOGGLED_DEF.id);
  const toggledCandidates: AgendaCandidate[] = [];
  for (const c of await allCandidates(seeded)) {
    if ((await primarySourceIdOf(seeded, c)) === TOGGLED_DEF.id) toggledCandidates.push(c);
  }
  return { seeded, a, b, toggledCandidates };
}

describe("3B.1 pre-pool parity: non-active universe equals the source being removed up front", () => {
  for (const status of NON_ACTIVE) {
    it(`${status}: filtered universe, unique-article pre-pool and final MM context are deep-equal`, async () => {
      const { a, b, toggledCandidates } = await lifecycleAB(status);
      expect(toggledCandidates.length).toBeGreaterThan(0);

      // (A) lifecycle-filtered universe
      const eligibleA = createMmSourceLifecycleEligibility(a);
      const universeA = await allCandidates(a);
      const refsA = await a.findAgendaCandidateArticleRefs(universeA);
      const filteredA: AgendaCandidate[] = [];
      for (const c of universeA) if (await eligibleA(c, refsA.get(c.id))) filteredA.push(c);
      expect(filteredA).toEqual(await allCandidates(b));

      // (B) unique-article pre-pool
      const unfilteredA = await prePool(a, { eligibility: null });
      expect(unfilteredA.candidates.some((c) => toggledCandidates.some((t) => t.id === c.id))).toBe(true);
      const prePoolA = await prePool(a);
      const prePoolB = await prePool(b);
      expect({ candidates: prePoolA.candidates, diagnostics: prePoolA.diagnostics }).toEqual({
        candidates: prePoolB.candidates,
        diagnostics: prePoolB.diagnostics,
      });
      expect(prePoolA.ineligibleRowsSkipped).toBe(toggledCandidates.length);
      expect(prePoolB.ineligibleRowsSkipped).toBe(0);
      expect(await prePool(b, { eligibility: null })).toEqual(prePoolB);

      // Small pages move page boundaries; the kept candidates must still match.
      expect((await prePool(a, { pageSize: 3 })).candidates).toEqual((await prePool(b, { pageSize: 3 })).candidates);

      // (C) final MM context
      const mmA = await runMmWithPrePoolLog(a);
      const mmB = await runMmWithPrePoolLog(b);
      expect(mmA.mm.agendaCandidates.length).toBeGreaterThan(0);
      expect(mmA.mm).toEqual(mmB.mm);
      expect(mmA.mm.notes.some((n) => n.startsWith("source_lifecycle_excluded:"))).toBe(false);
      expect(mmA.prePoolLog.sourceLifecycleExcludedRows).toBe(toggledCandidates.length);
      expect(mmB.prePoolLog.sourceLifecycleExcludedRows).toBe(0);
    });
  }

  it("all-active registry: the predicate is a no-op on pre-pool and MM output", async () => {
    const seeded = await seededCycleRepo();
    expect(await prePool(seeded)).toEqual(await prePool(seeded, { eligibility: null }));
    const filtered = await runMmWithPrePoolLog(seeded);
    expect(filtered.prePoolLog.sourceLifecycleExcludedRows).toBe(0);
    expect(filtered.mm.notes.some((n) => n.startsWith("source_lifecycle_excluded:"))).toBe(false);
  });

  it("reactivation restores the exact pre-lifecycle MM context; no row was touched", async () => {
    const { seeded, a } = await lifecycleAB("paused");
    const before = await runMm(seeded);
    const rowsBefore = structuredClone(await allCandidates(a));
    await runMm(a);
    expect(await allCandidates(a)).toEqual(rowsBefore);
    await a.upsertSource(sourceRow(TOGGLED_DEF));
    const reactivated = await runMmWithPrePoolLog(a);
    expect(reactivated.prePoolLog.sourceLifecycleExcludedRows).toBe(0);
    expect(reactivated.mm).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Synthetic universe with explicit scores and URLs.
// ---------------------------------------------------------------------------

type RowSpec = { key: string; source: "active" | "toggled"; score: number; url?: string };

function uuid(group: number, n: number): string {
  return `${group.toString(16).padStart(8, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

async function seedSynthetic(specs: RowSpec[], toggledStatus?: ResearchSourceLifecycleStatus) {
  const sources = [sourceRow(ACTIVE_DEF), sourceRow(TOGGLED_DEF, toggledStatus)];
  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  const repo = createInMemoryResearchRepository(sources);
  const byKey = new Map<string, AgendaCandidate>();
  for (const [i, spec] of specs.entries()) {
    const n = i + 1;
    const sourceId = spec.source === "active" ? ACTIVE_DEF.id : TOGGLED_DEF.id;
    const url = spec.url ?? `https://news.example/${spec.key}`;
    const base = signalFixture({
      id: uuid(1, n),
      title: `Travel update ${spec.key}`,
      summary: `Seasonal travel update ${spec.key}.`,
      signalType: "general_travel_news",
      sourceId,
      sourceType: spec.source === "active" ? ACTIVE_DEF.sourceType : TOGGLED_DEF.sourceType,
      canonicalUrl: url,
      rawFingerprint: `raw-${spec.key}`,
      normalizedFingerprint: `norm-${spec.key}`,
      observedAt: ISO,
      publishedAt: ISO,
      createdAt: ISO,
      updatedAt: ISO,
    });
    const signal = await repo.upsertSignal({
      ...base,
      evidence: base.evidence.map((e) => ({ ...e, sourceId, url })),
    });
    const brief = buildResearchBriefFromCluster({
      cluster: {
        id: uuid(2, n),
        primarySignalId: signal.id,
        signalIds: [signal.id],
        clusterType: "destination_group",
        createdAt: ISO,
        updatedAt: ISO,
      },
      signals: [signal],
      sources: sourceMap,
      now: NOW,
    })!;
    await repo.upsertBrief(brief);
    const candidate: AgendaCandidate = {
      ...buildAgendaCandidateFromBrief(brief, NOW),
      id: uuid(3, n),
      compositeResearchScore: spec.score,
      createdAt: ISO,
      updatedAt: ISO,
    };
    await repo.upsertAgendaCandidate(candidate);
    byKey.set(spec.key, candidate);
  }
  return { repo, byKey };
}

const keysOf = (rows: AgendaCandidate[], byKey: Map<string, AgendaCandidate>) => {
  const keyById = new Map([...byKey].map(([key, c]) => [c.id, key]));
  return rows.map((c) => keyById.get(c.id));
};

/** 3 toggled rows ranked above 8 active rows. */
const CAPACITY_SPECS: RowSpec[] = [
  { key: "t1", source: "toggled", score: 0.99 },
  { key: "t2", source: "toggled", score: 0.98 },
  { key: "t3", source: "toggled", score: 0.97 },
  ...Array.from({ length: 8 }, (_, i) => ({ key: `a${i + 1}`, source: "active" as const, score: 0.9 - i * 0.01 })),
];
const ACTIVE_ONLY_SPECS = CAPACITY_SPECS.filter((s) => s.source === "active");

describe("3B.1 capacity displacement", () => {
  for (const status of NON_ACTIVE) {
    it(`${status}: high-ranked non-active rows no longer consume the N slots; the next active rows enter`, async () => {
      const { repo, byKey } = await seedSynthetic(CAPACITY_SPECS, status);
      const { repo: activeOnly } = await seedSynthetic(ACTIVE_ONLY_SPECS);

      const unfiltered = await prePool(repo, { target: 5, eligibility: null });
      expect(keysOf(unfiltered.candidates, byKey)).toEqual(["t1", "t2", "t3", "a1", "a2"]);

      const filtered = await prePool(repo, { target: 5 });
      expect(keysOf(filtered.candidates, byKey)).toEqual(["a1", "a2", "a3", "a4", "a5"]);
      expect(filtered.ineligibleRowsSkipped).toBe(3);
      expect(filtered.diagnostics.uniqueArticleCandidates).toBe(5);

      const reference = await prePool(activeOnly, { target: 5, eligibility: null });
      expect(filtered.candidates.map((c) => c.title)).toEqual(reference.candidates.map((c) => c.title));
      expect(filtered.diagnostics).toEqual(reference.diagnostics);
    });
  }

  it("interleaved non-active rows across small pages keep the active-only order", async () => {
    const specs: RowSpec[] = [
      { key: "a1", source: "active", score: 0.95 },
      { key: "t1", source: "toggled", score: 0.94 },
      { key: "t2", source: "toggled", score: 0.93 },
      { key: "a2", source: "active", score: 0.92 },
      { key: "t3", source: "toggled", score: 0.91 },
      { key: "a3", source: "active", score: 0.9 },
      { key: "a4", source: "active", score: 0.89 },
      { key: "t4", source: "toggled", score: 0.88 },
      { key: "a5", source: "active", score: 0.87 },
    ];
    const { repo, byKey } = await seedSynthetic(specs, "paused");
    const filtered = await prePool(repo, { target: 4, pageSize: 2 });
    expect(keysOf(filtered.candidates, byKey)).toEqual(["a1", "a2", "a3", "a4"]);
    expect(filtered.diagnostics).toMatchObject({ uniqueArticleCandidates: 4, fetchedCandidateRows: 4, duplicateRowsDropped: 0 });
  });

  it("a non-active row no longer claims the article identity of a lower-ranked active duplicate", async () => {
    const shared = "https://news.example/shared-story";
    const specs: RowSpec[] = [
      { key: "t1", source: "toggled", score: 0.99, url: shared },
      { key: "a1", source: "active", score: 0.5, url: shared },
      { key: "a2", source: "active", score: 0.4 },
    ];
    const { repo, byKey } = await seedSynthetic(specs, "paused");
    const unfiltered = await prePool(repo, { eligibility: null });
    expect(keysOf(unfiltered.candidates, byKey)).toEqual(["t1", "a2"]);
    expect(unfiltered.diagnostics.duplicateRowsDropped).toBe(1);

    const filtered = await prePool(repo);
    expect(keysOf(filtered.candidates, byKey)).toEqual(["a1", "a2"]);
    expect(filtered.diagnostics.duplicateRowsDropped).toBe(0);
  });

  it("legacy row-limit mode widens the read so non-active rows do not shrink the pool", async () => {
    const { repo, byKey } = await seedSynthetic(CAPACITY_SPECS, "paused");
    const { repo: activeOnly } = await seedSynthetic(ACTIVE_ONLY_SPECS);
    const legacy = legacyView(repo);

    const unfiltered = await prePool(legacy, { target: 5, eligibility: null });
    expect(keysOf(unfiltered.candidates, byKey)).toEqual(["t1", "t2", "t3", "a1", "a2"]);

    const filtered = await prePool(legacy, { target: 5, eligibility: createMmSourceLifecycleEligibility(legacy) });
    expect(keysOf(filtered.candidates, byKey)).toEqual(["a1", "a2", "a3", "a4", "a5"]);
    expect(filtered.ineligibleRowsSkipped).toBe(3);

    const reference = await prePool(legacyView(activeOnly), { target: 5, eligibility: null });
    const { pagesRead, ...rest } = filtered.diagnostics;
    const { pagesRead: referencePagesRead, ...referenceRest } = reference.diagnostics;
    expect(rest).toEqual(referenceRest);
    expect([pagesRead, referencePagesRead]).toEqual([2, 1]);
  });

  it("legacy mode with nothing excluded performs the single unchanged read", async () => {
    const { repo: activeOnly } = await seedSynthetic(ACTIVE_ONLY_SPECS);
    const legacy = legacyView(activeOnly);
    const filtered = await prePool(legacy, { target: 5, eligibility: createMmSourceLifecycleEligibility(legacy) });
    const unfiltered = await prePool(legacy, { target: 5, eligibility: null });
    expect(filtered).toEqual(unfiltered);
  });

  it("MM-level: 180 pre-pool slots go to active candidates; MM context equals the active-only universe", async () => {
    const paused = Array.from({ length: 10 }, (_, i) => ({ key: `t${i}`, source: "toggled" as const, score: 0.99 - i * 0.0001 }));
    const active = Array.from({ length: 200 }, (_, i) => ({ key: `a${i}`, source: "active" as const, score: 0.9 - i * 0.001 }));
    const { repo } = await seedSynthetic([...paused, ...active], "paused");
    const { repo: activeOnly } = await seedSynthetic(active);

    const a = await runMmWithPrePoolLog(repo, 18);
    const b = await runMmWithPrePoolLog(activeOnly, 18);
    expect(a.prePoolLog).toMatchObject({ targetUniqueArticles: 180, uniqueArticleCandidates: 180, sourceLifecycleExcludedRows: 10 });
    expect(a.mm.observability.articlePrePool).toEqual(b.mm.observability.articlePrePool);
    const titles = (mm: typeof a.mm) => ({
      candidates: mm.agendaCandidates.map((c) => c.title),
      briefs: mm.briefs.map((x) => x.title),
      notes: mm.notes,
      status: mm.status,
    });
    expect(a.mm.agendaCandidates.length).toBeGreaterThan(0);
    expect(titles(a.mm)).toEqual(titles(b.mm));
    expect(a.mm.briefs.some((x) => x.evidence.some((e) => e.sourceId === TOGGLED_DEF.id))).toBe(false);
  });
});

describe("3B.1 final MM gate stays as defense in depth", () => {
  it("a non-active candidate that slips past the pre-pool is still excluded by the final gate", async () => {
    const { repo } = await seedSynthetic(CAPACITY_SPECS, "paused");
    const staleRefs = withOverrides(repo, {
      async findAgendaCandidateArticleRefs(candidates) {
        const refs = await repo.findAgendaCandidateArticleRefs(candidates);
        for (const ref of refs.values()) ref.sourceId = ACTIVE_DEF.id;
        return refs;
      },
    });
    const { mm, prePoolLog } = await runMmWithPrePoolLog(staleRefs);
    expect(mm.agendaCandidates.length).toBeGreaterThan(0);
    expect(prePoolLog.sourceLifecycleExcludedRows).toBe(0);
    expect(mm.notes).toContain("source_lifecycle_excluded:3");
    expect(mm.briefs.some((x) => x.evidence.some((e) => e.sourceId === TOGGLED_DEF.id))).toBe(false);
  });
});

describe("6B-2 pre-pool eligibility is fail-closed", () => {
  it("missing source rows and rows without semantics are excluded in the pre-pool and MM", async () => {
    const { repo, byKey } = await seedSynthetic(CAPACITY_SPECS);
    const expected = keysOf((await prePool(repo, { eligibility: null })).candidates, byKey).filter((key) => !key?.startsWith("t"));

    const missingRow = withOverrides(repo, {
      async getSourceById(id: string) {
        return id === TOGGLED_DEF.id ? null : repo.getSourceById(id);
      },
    });
    expect(keysOf((await prePool(missingRow)).candidates, byKey)).toEqual(expected);

    await repo.upsertSource({ ...sourceRow(TOGGLED_DEF), metadata: {} });
    expect(keysOf((await prePool(repo)).candidates, byKey)).toEqual(expected);
    const { mm, prePoolLog } = await runMmWithPrePoolLog(repo);
    expect(prePoolLog.sourceLifecycleExcludedRows).toBe(3);
    expect(mm.notes.some((n) => n.startsWith("source_lifecycle_excluded:"))).toBe(false);
  });

  it("without an article ref the primary source resolves through brief → primary signal", async () => {
    const { repo, byKey } = await seedSynthetic(CAPACITY_SPECS, "paused");
    const eligible = createMmSourceLifecycleEligibility(repo);
    expect(await eligible(byKey.get("t1")!, undefined)).toBe(false);
    expect(await eligible(byKey.get("a1")!, undefined)).toBe(true);
    expect(await eligible({ ...byKey.get("t1")!, researchBriefId: "missing-brief" }, undefined)).toBe(false);
  });

  it("a throwing lookup excludes the candidate without treating the source as active", async () => {
    const { repo, byKey } = await seedSynthetic(CAPACITY_SPECS, "paused");
    const failing = withOverrides(repo, {
      async getSourceById(id: string) {
        if (id === TOGGLED_DEF.id) throw new Error("source lookup down");
        return repo.getSourceById(id);
      },
    });
    const cache = new Map<string, ResearchSource | null>();
    const eligible = createMmSourceLifecycleEligibility(failing, cache);
    expect(await eligible(byKey.get("t1")!, undefined)).toBe(false);
    expect(cache.has(TOGGLED_DEF.id)).toBe(false);
    const mm = await runMm(failing);
    expect(mm.agendaCandidates.length).toBeGreaterThan(0);
    expect(mm.briefs.some((brief) => brief.evidence.some((e) => e.sourceId === TOGGLED_DEF.id))).toBe(false);
  });
});
