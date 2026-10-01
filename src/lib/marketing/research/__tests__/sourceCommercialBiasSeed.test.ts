import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ResearchSourceSemantics } from "@/lib/marketing/research";
import {
  EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  META_AI_TREND_SOURCE_DEFINITION,
  NYT_TRAVEL_SOURCE,
  PERFORMANCE_MEMORY_SOURCE_DEFINITION,
  RESEARCH_SOURCE_REGISTRY,
  TRAVELDAILY_SOURCE,
  TRAVELTIMES_SOURCE,
  TRAVIE_SOURCE,
  UK_GOV_TRAVEL_SOURCE,
  VIETNAM_TRAVEL_SOURCE,
  createResearchCollectorForSource,
  mapRawResearchItemToSignalInput,
  projectResearchSource,
  type ExternalResearchSourceDefinition,
  type ResearchSourceDefinition,
} from "@/lib/marketing/research/collectors";
import { collectUniqueArticleAgendaCandidates } from "@/lib/marketing/research/manager/collectUniqueArticleAgendaCandidates";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import type { MarketingResearchContext } from "@/lib/marketing/research/manager/types";
import {
  aggregateEvidenceSourceRoleWeights,
  resolveSourceRoleWeights,
} from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { buildAgendaCandidateFromBrief } from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { buildResearchBriefFromCluster } from "@/lib/marketing/research/services/briefBuilder";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import { runResearchPipeline } from "@/lib/marketing/research/services/pipeline";
import { computeAgendaPoolRankScore } from "@/lib/marketing/research/services/scoringPolicy";
import {
  COMMERCIAL_BIAS_AGENDA_SEED_RETENTION,
  adjustAgendaSeedForCommercialBias,
  aggregateBiasAdjustedAgendaSeedWeight,
  resolveCommercialBias,
} from "@/lib/marketing/research/sourceCommercialBias";
import type { AgendaCandidate } from "@/lib/marketing/research/types/researchBrief";
import type { RawResearchSignalInput } from "@/lib/marketing/research/types/researchSignal";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { ResearchSourceCommercialBias } from "@/lib/marketing/research/types/sourceSemantics";
import { buildMetaAiTrendSource } from "@/lib/marketing/trends/adapter/trendSourceAdapter";
import {
  PARITY_FIXTURE_BY_FEED,
  mockFeedFetch,
  withoutSemantics,
} from "@/lib/marketing/research/__tests__/sourceRegistryParityFixtures";
import { signalFixture } from "@/lib/marketing/research/__tests__/semanticCalibrationFixtures";

const NOW = new Date("2026-10-01T09:00:00.000Z");
const ISO = NOW.toISOString();

const LEVELS: ResearchSourceCommercialBias[] = ["none", "low", "medium", "high"];

function row(definition: ResearchSourceDefinition): ResearchSource {
  return { ...projectResearchSource(definition), createdAt: ISO, updatedAt: ISO };
}

function withBias<T extends ResearchSourceDefinition>(definition: T, commercialBias: ResearchSourceCommercialBias): T {
  const clone = structuredClone(definition);
  clone.semantics = { ...clone.semantics, commercialBias };
  return clone;
}

/** Synthetic source with an explicit seed and bias; ids are deliberately outside the registry. */
function syntheticSource(id: string, seed: number, commercialBias?: unknown): ResearchSource {
  const base = row(TRAVELTIMES_SOURCE);
  const semantics = { ...(base.metadata?.semantics as ResearchSourceSemantics) } as Record<string, unknown>;
  if (commercialBias === undefined) delete semantics.commercialBias;
  else semantics.commercialBias = commercialBias;
  return {
    ...base,
    id,
    name: `Synthetic ${id.slice(-4)}`,
    provider: `synthetic-${id.slice(-4)}.example`,
    metadata: {
      ...base.metadata,
      portfolio: { ...(base.metadata?.portfolio as Record<string, unknown>), agendaSeedWeight: seed },
      semantics,
    },
  };
}

function omitKeys(value: object, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function uuid(group: number, n: number): string {
  return `${group.toString(16).padStart(8, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

// ---------------------------------------------------------------------------
// Policy units
// ---------------------------------------------------------------------------

describe("commercialBias agenda seed — policy", () => {
  it("retention table is none 1.00 / low 0.90 / medium 0.75 / high 0.50", () => {
    expect(COMMERCIAL_BIAS_AGENDA_SEED_RETENTION).toEqual({ none: 1, low: 0.9, medium: 0.75, high: 0.5 });
  });

  it("0.9 seed: none / low / medium / high → 0.90 / 0.86 / 0.80 / 0.70", () => {
    const adjusted = LEVELS.map((bias) => adjustAgendaSeedForCommercialBias(0.9, bias));
    [0.9, 0.86, 0.8, 0.7].forEach((expected, i) => expect(adjusted[i]).toBeCloseTo(expected, 12));
    expect(adjusted[0]).toBe(0.9);
  });

  it("seeds at or below 0.5 are never attenuated, even under high bias", () => {
    for (const seed of [0.5, 0.35, 0]) {
      for (const bias of LEVELS) expect(adjustAgendaSeedForCommercialBias(seed, bias)).toBe(seed);
    }
  });

  it("0.78 + low → 0.752 (only the boost above 0.5 shrinks)", () => {
    expect(adjustAgendaSeedForCommercialBias(0.78, "low")).toBeCloseTo(0.752, 12);
  });

  it("missing or invalid semantics / commercialBias remain unresolved", () => {
    const base = row(TRAVELTIMES_SOURCE);
    const cases: Array<ResearchSource | null | undefined> = [
      null,
      undefined,
      { ...base, metadata: null } as unknown as ResearchSource,
      { ...base, metadata: {} },
      { ...base, metadata: { semantics: "medium" } },
      { ...base, metadata: { semantics: null } },
      { ...base, metadata: { semantics: {} } },
      { ...base, metadata: { semantics: { commercialBias: "extreme" } } },
      { ...base, metadata: { semantics: { commercialBias: "MEDIUM" } } },
      { ...base, metadata: { semantics: { commercialBias: 3 } } },
      withoutSemantics(base),
    ];
    for (const source of cases) expect(resolveCommercialBias(source)).toBeNull();
    expect(resolveCommercialBias(base)).toBe("medium");
  });

  it("unresolved bias grants no above-neutral agenda boost", () => {
    const legacy = withoutSemantics(row(TRAVELTIMES_SOURCE));
    expect(aggregateBiasAdjustedAgendaSeedWeight([legacy])).toEqual({
      rawAgendaSeedWeight: 0.9,
      biasAdjustedAgendaSeedWeight: 0.5,
      commercialBias: null,
      seedSourceId: TRAVELTIMES_SOURCE.id,
    });
    expect(aggregateBiasAdjustedAgendaSeedWeight([syntheticSource(uuid(9, 1), 0.9, undefined)]).biasAdjustedAgendaSeedWeight).toBe(0.5);
    expect(aggregateBiasAdjustedAgendaSeedWeight([syntheticSource(uuid(9, 2), 0.9, "bogus")]).biasAdjustedAgendaSeedWeight).toBe(0.5);
  });
});

describe("commercialBias agenda seed — multi-source aggregation", () => {
  it("A: 0.9 medium (→0.80) vs 0.70 none → 0.80 from the medium source", () => {
    const a = syntheticSource(uuid(9, 11), 0.9, "medium");
    const b = syntheticSource(uuid(9, 12), 0.7, "none");
    const result = aggregateBiasAdjustedAgendaSeedWeight([a, b]);
    expect(result.rawAgendaSeedWeight).toBe(0.9);
    expect(result.biasAdjustedAgendaSeedWeight).toBeCloseTo(0.8, 12);
    expect([result.commercialBias, result.seedSourceId]).toEqual(["medium", a.id]);
  });

  it("B: 0.9 medium (→0.80) vs 0.82 none → 0.82; the adjusted winner differs from the raw winner", () => {
    const a = syntheticSource(uuid(9, 21), 0.9, "medium");
    const b = syntheticSource(uuid(9, 22), 0.82, "none");
    for (const order of [[a, b], [b, a]]) {
      const result = aggregateBiasAdjustedAgendaSeedWeight(order);
      expect(result).toEqual({ rawAgendaSeedWeight: 0.9, biasAdjustedAgendaSeedWeight: 0.82, commercialBias: "none", seedSourceId: b.id });
    }
    // Candidate-level bias (max or average over sources) would attenuate B's seed as well.
    expect(adjustAgendaSeedForCommercialBias(0.9, "medium")).toBeLessThan(0.82);
  });

  it("C: 0.40 high (unchanged) vs 0.35 none → 0.40", () => {
    const a = syntheticSource(uuid(9, 31), 0.4, "high");
    const b = syntheticSource(uuid(9, 32), 0.35, "none");
    const result = aggregateBiasAdjustedAgendaSeedWeight([b, a]);
    expect(result).toEqual({ rawAgendaSeedWeight: 0.4, biasAdjustedAgendaSeedWeight: 0.4, commercialBias: "high", seedSourceId: a.id });
  });

  it("raw seed equals aggregateEvidenceSourceRoleWeights; empty and null sources keep its fallbacks", () => {
    const sets: Array<Array<ResearchSource | null>> = [
      [],
      [null],
      [row(TRAVELTIMES_SOURCE), row(VIETNAM_TRAVEL_SOURCE)],
      [row(UK_GOV_TRAVEL_SOURCE), null, row(NYT_TRAVEL_SOURCE)],
      RESEARCH_SOURCE_REGISTRY.map(row),
    ];
    for (const sources of sets) {
      const role = aggregateEvidenceSourceRoleWeights(sources);
      const before = structuredClone(sources);
      const seed = aggregateBiasAdjustedAgendaSeedWeight(sources);
      expect(seed.rawAgendaSeedWeight).toBe(role.agendaSeedWeight);
      expect(sources).toEqual(before);
    }
    expect(aggregateBiasAdjustedAgendaSeedWeight([])).toEqual({
      rawAgendaSeedWeight: 0.4,
      biasAdjustedAgendaSeedWeight: 0.4,
      commercialBias: null,
      seedSourceId: null,
    });
  });
});

describe("commercialBias agenda seed — registry representatives", () => {
  const seedOf = (definition: ResearchSourceDefinition) => aggregateBiasAdjustedAgendaSeedWeight([row(definition)]);

  it("Korean trade press (medium): 0.90 / 0.88 / 0.86 → 0.80 / 0.785 / 0.77; role weights untouched", () => {
    const expected: Array<[ResearchSourceDefinition, number, number]> = [
      [TRAVELTIMES_SOURCE, 0.9, 0.8],
      [TRAVIE_SOURCE, 0.88, 0.785],
      [TRAVELDAILY_SOURCE, 0.86, 0.77],
    ];
    for (const [definition, raw, adjusted] of expected) {
      const seed = seedOf(definition);
      expect(seed.commercialBias).toBe("medium");
      expect(seed.rawAgendaSeedWeight).toBe(raw);
      expect(seed.biasAdjustedAgendaSeedWeight).toBeCloseTo(adjusted, 12);
      expect(resolveSourceRoleWeights(row(definition)).agendaSeedWeight).toBe(raw);
    }
  });

  it("Vietnam Tourism (medium): raw seed read from the registry, 0.78 → 0.71", () => {
    const raw = resolveSourceRoleWeights(row(VIETNAM_TRAVEL_SOURCE)).agendaSeedWeight;
    expect(raw).toBe(0.78);
    const seed = seedOf(VIETNAM_TRAVEL_SOURCE);
    expect(seed.commercialBias).toBe("medium");
    expect(seed.biasAdjustedAgendaSeedWeight).toBeCloseTo(0.5 + (raw - 0.5) * 0.75, 12);
    expect(seed.biasAdjustedAgendaSeedWeight).toBeCloseTo(0.71, 12);
  });

  it("NYT (low) 0.52 → 0.518; FCDO (none) 0.18 unchanged", () => {
    expect(seedOf(NYT_TRAVEL_SOURCE).biasAdjustedAgendaSeedWeight).toBeCloseTo(0.518, 12);
    expect(seedOf(UK_GOV_TRAVEL_SOURCE)).toMatchObject({ rawAgendaSeedWeight: 0.18, biasAdjustedAgendaSeedWeight: 0.18, commercialBias: "none" });
  });

  it("Performance Memory (none, 0.35) and Meta Trend (low, `other` 0.4) are no-ops", () => {
    expect(seedOf(PERFORMANCE_MEMORY_SOURCE_DEFINITION)).toMatchObject({
      rawAgendaSeedWeight: 0.35,
      biasAdjustedAgendaSeedWeight: 0.35,
      commercialBias: "none",
    });
    const meta = buildMetaAiTrendSource(NOW);
    expect(META_AI_TREND_SOURCE_DEFINITION.semantics.commercialBias).toBe("low");
    expect(aggregateBiasAdjustedAgendaSeedWeight([meta])).toMatchObject({
      rawAgendaSeedWeight: 0.4,
      biasAdjustedAgendaSeedWeight: 0.4,
      commercialBias: "low",
    });
  });
});

// ---------------------------------------------------------------------------
// Production parity fixture: collect → pipeline → MM
// ---------------------------------------------------------------------------

type BiasById = Partial<Record<string, ResearchSourceCommercialBias>>;

function definitionsWith(biasById: BiasById | "all-none"): ExternalResearchSourceDefinition[] {
  return EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((source) => {
    const bias = biasById === "all-none" ? "none" : biasById[source.id];
    return bias ? withBias(source, bias) : source;
  });
}

async function scenario(definitions: readonly ExternalResearchSourceDefinition[]) {
  const repo = createInMemoryResearchRepository();
  for (const source of definitions) await repo.upsertSource(row(source));
  const collected: Array<{ raw: RawResearchSignalInput; rawFingerprint: string | null; normalizedFingerprint: string | null }> = [];
  for (const source of definitions) {
    const collector = createResearchCollectorForSource(source, { fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) });
    for (const item of await collector.collect({ sourceId: source.id, sourceType: source.sourceType, now: NOW, maxItems: 25 })) {
      const mapped = mapRawResearchItemToSignalInput(item, { sourceId: source.id, sourceType: source.sourceType });
      if (!mapped) continue;
      const normalized = normalizeResearchSignal(mapped, row(source), NOW);
      collected.push({
        raw: mapped,
        rawFingerprint: normalized.ok ? (normalized.signal.rawFingerprint ?? null) : null,
        normalizedFingerprint: normalized.ok ? (normalized.signal.normalizedFingerprint ?? null) : null,
      });
    }
  }
  const pipeline = await runResearchPipeline({ repo, rawSignals: collected.map((c) => c.raw), now: NOW });
  const since = new Date(NOW.getTime() - 168 * 3_600_000).toISOString();
  const prePool = await collectUniqueArticleAgendaCandidates(repo, { since, targetUniqueArticles: 300 });
  const prePoolSmallPages = await collectUniqueArticleAgendaCandidates(repo, { since, targetUniqueArticles: 300, pageSize: 3 });
  const logs: Array<Record<string, unknown>> = [];
  const spy = vi.spyOn(console, "info").mockImplementation((tag: unknown, payload: unknown) => {
    if (tag === "[mm-research-context]" && typeof payload === "string") logs.push(JSON.parse(payload));
  });
  let mm: MarketingResearchContext;
  try {
    mm = await getMarketingManagerResearchContext(
      { lookbackHours: 168, limit: 30 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => false },
    );
  } finally {
    spy.mockRestore();
  }
  const storedFingerprints = (await repo.findRecentSignals({ since: "1970-01-01T00:00:00.000Z", limit: 100_000 }))
    .map((signal) => `${signal.rawFingerprint}|${signal.normalizedFingerprint}|${signal.status}`)
    .sort();
  return { repo, collected, pipeline, prePool, prePoolSmallPages, mm, logs, storedFingerprints };
}

type Scenario = Awaited<ReturnType<typeof scenario>>;

/** Pipeline-side scores by title; ids are random per run. */
function compositeView(s: Scenario) {
  return s.pipeline.agendaCandidates
    .map((c) => ({
      title: c.title,
      compositeResearchScore: c.compositeResearchScore,
      credibilityScore: c.credibilityScore,
      corroborationScore: c.corroborationScore,
      commercialLinkageScore: c.commercialLinkageScore,
      koreanOutboundRelevanceScore: c.koreanOutboundRelevanceScore,
      researchScoreComponents: c.researchScoreComponents,
      scoreReasons: c.scoreReasons,
      riskFlags: c.riskFlags,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** MM compact candidates minus random ids, keyed by title. */
function mmCandidateView(s: Scenario) {
  return s.mm.agendaCandidates
    .map((candidate) => ({
      ...omitKeys(candidate, ["agendaCandidateId", "researchBriefId", "evidence"]),
      title: candidate.title,
      evidence: candidate.evidence.map((e) => omitKeys(e, ["evidenceId"])),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

const mmOrder = (s: Scenario) => s.mm.agendaCandidates.map((c) => c.title);
const prePoolTitles = (s: Scenario) => s.prePool.candidates.map((c) => c.title);

const observabilityWithoutAttenuation = (s: Scenario) =>
  omitKeys(s.mm.observability, ["agendaSeedAttenuation", "requestedAt"]);

describe("commercialBias agenda seed — production fixture MM", () => {
  it("only the final MM rank seed moves: composite, Korean outbound, pre-pool and fingerprints are bias-independent", async () => {
    const allNone = await scenario(definitionsWith("all-none"));
    const registry = await scenario(definitionsWith({}));
    const allHigh = await scenario(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => withBias(s, "high")));
    expect(allNone.mm.agendaCandidates.length).toBeGreaterThan(3);

    for (const variant of [registry, allHigh]) {
      // UNCHANGED_COMPOSITE: credibility, corroboration, commercial, composite, reasons, fingerprints.
      expect(compositeView(variant)).toEqual(compositeView(allNone));
      expect(variant.collected.map((c) => [c.rawFingerprint, c.normalizedFingerprint])).toEqual(
        allNone.collected.map((c) => [c.rawFingerprint, c.normalizedFingerprint]),
      );
      expect(variant.storedFingerprints).toEqual(allNone.storedFingerprints);
      // UNCHANGED_KOREAN_OUTBOUND: every MM field except order (outbound, reasons, risks, components).
      expect(mmCandidateView(variant)).toEqual(mmCandidateView(allNone));
      // Pre-pool set, order and diagnostics.
      expect(prePoolTitles(variant)).toEqual(prePoolTitles(allNone));
      expect(variant.prePool.diagnostics).toEqual(allNone.prePool.diagnostics);
      expect(variant.prePoolSmallPages.candidates.map((c) => c.title)).toEqual(allNone.prePoolSmallPages.candidates.map((c) => c.title));
      expect(variant.mm.observability.articlePrePool).toEqual(allNone.mm.observability.articlePrePool);
      expect(observabilityWithoutAttenuation(variant)).toEqual(observabilityWithoutAttenuation(allNone));
      expect(variant.mm.notes).toEqual(allNone.mm.notes);
    }

    // Raw portfolio weights stored on the source rows never change.
    for (const source of await registry.repo.listEnabledSources()) {
      const twin = (await allHigh.repo.listEnabledSources()).find((s) => s.id === source.id)!;
      expect(resolveSourceRoleWeights(twin)).toEqual(resolveSourceRoleWeights(source));
    }

    // all-none: no attenuation is recorded and the observability shape is the pre-5B one.
    expect(allNone.mm.observability).not.toHaveProperty("agendaSeedAttenuation");
    expect(allNone.logs.some((l) => l.event === "agenda_seed_attenuation")).toBe(false);
  });

  it("registry: trade press and Vietnam seeds are attenuated only in diagnostics; credibility is untouched", async () => {
    const allNone = await scenario(definitionsWith("all-none"));
    const registry = await scenario(definitionsWith({}));
    const attenuation = registry.mm.observability.agendaSeedAttenuation!;
    expect(attenuation.attenuatedRankedCount).toBeGreaterThan(0);
    expect(attenuation.attenuatedCandidateCount).toBe(attenuation.attenuatedRankedCount);
    expect(attenuation.candidates.length).toBeGreaterThan(0);
    expect(registry.logs.find((l) => l.event === "agenda_seed_attenuation")).toMatchObject(attenuation);

    const expectedBySource = new Map<string, [number, number]>([
      [TRAVELTIMES_SOURCE.id, [0.9, 0.8]],
      [TRAVIE_SOURCE.id, [0.88, 0.785]],
      [TRAVELDAILY_SOURCE.id, [0.86, 0.77]],
      [VIETNAM_TRAVEL_SOURCE.id, [0.78, 0.71]],
      [NYT_TRAVEL_SOURCE.id, [0.52, 0.518]],
    ]);
    const seenSources = new Set<string>();
    const mmById = new Map(registry.mm.agendaCandidates.map((c) => [c.agendaCandidateId, c]));
    for (const entry of attenuation.candidates) {
      expect(mmById.has(entry.agendaCandidateId)).toBe(true);
      const [raw, adjusted] = expectedBySource.get(entry.seedSourceId!)!;
      expect(entry.rawAgendaSeedWeight).toBe(raw);
      expect(entry.biasAdjustedAgendaSeedWeight).toBeCloseTo(adjusted, 12);
      expect(entry.commercialBias).toBe(entry.seedSourceId === NYT_TRAVEL_SOURCE.id ? "low" : "medium");
      seenSources.add(entry.seedSourceId!);
    }
    expect(seenSources.has(VIETNAM_TRAVEL_SOURCE.id)).toBe(true);
    expect([...seenSources].some((id) => [TRAVELTIMES_SOURCE.id, TRAVIE_SOURCE.id, TRAVELDAILY_SOURCE.id].includes(id))).toBe(true);

    // FCDO / Performance / Meta never appear.
    const neverAttenuated = new Set([UK_GOV_TRAVEL_SOURCE.id, PERFORMANCE_MEMORY_SOURCE_DEFINITION.id, META_AI_TREND_SOURCE_DEFINITION.id]);
    expect(attenuation.candidates.some((c) => neverAttenuated.has(c.seedSourceId!))).toBe(false);

    const vietnamCredibility = (s: Scenario) =>
      s.mm.agendaCandidates.filter((c) => c.evidence[0]?.sourceId === VIETNAM_TRAVEL_SOURCE.id).map((c) => [c.title, c.credibilityScore]);
    expect(vietnamCredibility(registry).length).toBeGreaterThan(0);
    expect(vietnamCredibility(registry)).toEqual(vietnamCredibility(allNone));
    expect(vietnamCredibility(registry).every(([, credibility]) => credibility === 1)).toBe(true);
  });

  it("none → medium mutation on one source: raw seed fixed, adjusted seed drops, only its MM rank score moves", async () => {
    const baseline = await scenario(definitionsWith("all-none"));
    const mutated = await scenario(definitionsWith({ ...Object.fromEntries(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => [s.id, "none" as const])), [TRAVELTIMES_SOURCE.id]: "medium" }));

    expect(compositeView(mutated)).toEqual(compositeView(baseline));
    expect(mmCandidateView(mutated)).toEqual(mmCandidateView(baseline));
    expect(prePoolTitles(mutated)).toEqual(prePoolTitles(baseline));
    expect(resolveSourceRoleWeights(await mutated.repo.getSourceById(TRAVELTIMES_SOURCE.id))).toEqual(
      resolveSourceRoleWeights(await baseline.repo.getSourceById(TRAVELTIMES_SOURCE.id)),
    );

    const attenuation = mutated.mm.observability.agendaSeedAttenuation!;
    expect(attenuation.candidates.length).toBeGreaterThan(0);
    for (const entry of attenuation.candidates) {
      expect(entry).toMatchObject({ seedSourceId: TRAVELTIMES_SOURCE.id, commercialBias: "medium", rawAgendaSeedWeight: 0.9 });
      expect(entry.biasAdjustedAgendaSeedWeight).toBeCloseTo(0.8, 12);
      const candidate = mutated.mm.agendaCandidates.find((c) => c.agendaCandidateId === entry.agendaCandidateId)!;
      const rankInput = {
        compositeResearchScore: candidate.totalResearchScore,
        koreanOutboundRelevanceScore: candidate.koreanOutboundRelevanceScore,
      };
      // INTENDED_MM_RANK_CHANGE
      expect(computeAgendaPoolRankScore({ ...rankInput, agendaSeedWeight: entry.biasAdjustedAgendaSeedWeight })).toBeLessThan(
        computeAgendaPoolRankScore({ ...rankInput, agendaSeedWeight: entry.rawAgendaSeedWeight }),
      );
    }
  });

  it("active rows without commercialBias retain candidate eligibility but no unknown-source boost", async () => {
    const allNone = await scenario(definitionsWith("all-none"));
    const legacy = await scenario(definitionsWith("all-none"));
    // Keep explicit active lifecycle while removing bias to isolate conservative rank handling.
    for (const source of await legacy.repo.listEnabledSources()) {
      const stripped = withoutSemantics(source);
      await legacy.repo.upsertSource({
        ...stripped,
        metadata: { ...stripped.metadata, semantics: { lifecycle: { status: "active" } } },
      });
    }
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const mm = await getMarketingManagerResearchContext(
        { lookbackHours: 168, limit: 30 },
        { repo: legacy.repo, now: NOW, checkSemanticInfrastructure: async () => false },
      );
      expect(mm.agendaCandidates.map((c) => c.title).sort()).toEqual(mmOrder(allNone).sort());
      const attenuation = mm.observability.agendaSeedAttenuation!;
      expect(attenuation.attenuatedCandidateCount).toBeGreaterThan(0);
      for (const candidate of attenuation.candidates) {
        expect(candidate.commercialBias).toBeNull();
        expect(candidate.biasAdjustedAgendaSeedWeight).toBe(Math.min(0.5, candidate.rawAgendaSeedWeight));
      }
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// Ordering fixture: equal composite and Korean outbound, only the seed differs
// ---------------------------------------------------------------------------

const FIXTURE_NOW = new Date("2026-09-02T00:00:00.000Z");
const FIXTURE_ISO = FIXTURE_NOW.toISOString();

async function orderingFixture(input: {
  a: { seed: number; bias: ResearchSourceCommercialBias };
  b: { seed: number; bias: ResearchSourceCommercialBias };
}) {
  const sources = [syntheticSource(uuid(7, 1), input.a.seed, input.a.bias), syntheticSource(uuid(7, 2), input.b.seed, input.b.bias)];
  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  const repo = createInMemoryResearchRepository(sources);
  const titles = ["Vietnam extends e-visa validity for Korean travelers", "Vietnam e-visa entry rules eased for tourists"];
  const candidates: AgendaCandidate[] = [];
  for (const [i, source] of sources.entries()) {
    const n = i + 1;
    const url = `https://news.example/vietnam-evisa-${n}`;
    const base = signalFixture({
      id: uuid(1, n),
      title: titles[i]!,
      summary: `${titles[i]} ahead of the autumn season.`,
      signalType: "entry_requirement",
      destinations: ["vietnam"],
      topics: ["visa", "travel"],
      sourceId: source.id,
      sourceType: source.sourceType,
      canonicalUrl: url,
      observedAt: FIXTURE_ISO,
      createdAt: FIXTURE_ISO,
      updatedAt: FIXTURE_ISO,
    });
    const signal = await repo.upsertSignal({ ...base, evidence: base.evidence.map((e) => ({ ...e, sourceId: source.id, url })) });
    const brief = buildResearchBriefFromCluster({
      cluster: { id: uuid(2, n), primarySignalId: signal.id, signalIds: [signal.id], clusterType: "destination_group", createdAt: FIXTURE_ISO, updatedAt: FIXTURE_ISO },
      signals: [signal],
      sources: sourceMap,
      now: FIXTURE_NOW,
    })!;
    await repo.upsertBrief(brief);
    const built = buildAgendaCandidateFromBrief(brief, FIXTURE_NOW);
    const candidate: AgendaCandidate = { ...built, id: uuid(3, n), compositeResearchScore: 0.8, createdAt: FIXTURE_ISO, updatedAt: FIXTURE_ISO };
    await repo.upsertAgendaCandidate(candidate);
    candidates.push(candidate);
  }
  const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  try {
    const mm = await getMarketingManagerResearchContext(
      { lookbackHours: 168, limit: 30 },
      { repo, now: FIXTURE_NOW, checkSemanticInfrastructure: async () => false },
    );
    const since = new Date(FIXTURE_NOW.getTime() - 168 * 3_600_000).toISOString();
    const prePool = await collectUniqueArticleAgendaCandidates(repo, { since, targetUniqueArticles: 10 });
    const label = new Map([[candidates[0]!.id, "A"], [candidates[1]!.id, "B"]]);
    return {
      mm,
      order: mm.agendaCandidates.map((c) => label.get(c.agendaCandidateId)),
      prePoolOrder: prePool.candidates.map((c) => label.get(c.id)),
      byLabel: Object.fromEntries(mm.agendaCandidates.map((c) => [label.get(c.agendaCandidateId)!, c])),
    };
  }
  finally {
    spy.mockRestore();
  }
}

describe("commercialBias agenda seed — ordering flip", () => {
  it("A 0.90 vs B 0.85: A first without bias, B first once A is medium (0.80); composite and outbound equal", async () => {
    const before = await orderingFixture({ a: { seed: 0.9, bias: "none" }, b: { seed: 0.85, bias: "none" } });
    const after = await orderingFixture({ a: { seed: 0.9, bias: "medium" }, b: { seed: 0.85, bias: "none" } });

    for (const run of [before, after]) {
      expect(run.byLabel.A!.totalResearchScore).toBe(run.byLabel.B!.totalResearchScore);
      expect(run.byLabel.A!.koreanOutboundRelevanceScore).toBe(run.byLabel.B!.koreanOutboundRelevanceScore);
    }
    for (const label of ["A", "B"] as const) {
      const volatile = ["agendaCandidateId", "researchBriefId", "evidence"];
      expect(omitKeys(after.byLabel[label]!, volatile)).toEqual(omitKeys(before.byLabel[label]!, volatile));
      const evidenceView = (run: typeof before) => run.byLabel[label]!.evidence.map((e) => [e.sourceId, e.url]);
      expect(evidenceView(after)).toEqual(evidenceView(before));
    }
    expect(after.prePoolOrder).toEqual(before.prePoolOrder);

    expect(before.order).toEqual(["A", "B"]);
    expect(after.order).toEqual(["B", "A"]);
    expect(after.mm.observability.agendaSeedAttenuation).toEqual({
      attenuatedRankedCount: 1,
      attenuatedCandidateCount: 1,
      candidates: [
        {
          agendaCandidateId: after.byLabel.A!.agendaCandidateId,
          commercialBias: "medium",
          rawAgendaSeedWeight: 0.9,
          biasAdjustedAgendaSeedWeight: expect.closeTo(0.8, 12),
          seedSourceId: uuid(7, 1),
        },
      ],
    });
  });

  it("A 0.90 medium (0.80) still beats B 0.78 none: the boost is attenuated once, not removed", async () => {
    const run = await orderingFixture({ a: { seed: 0.9, bias: "medium" }, b: { seed: 0.78, bias: "none" } });
    expect(run.byLabel.A!.koreanOutboundRelevanceScore).toBe(run.byLabel.B!.koreanOutboundRelevanceScore);
    expect(run.order).toEqual(["A", "B"]);
  });

  it("seeds at or below 0.5 keep their order under high bias", async () => {
    const run = await orderingFixture({ a: { seed: 0.5, bias: "high" }, b: { seed: 0.45, bias: "none" } });
    expect(run.order).toEqual(["A", "B"]);
    expect(run.mm.observability).not.toHaveProperty("agendaSeedAttenuation");
  });
});
