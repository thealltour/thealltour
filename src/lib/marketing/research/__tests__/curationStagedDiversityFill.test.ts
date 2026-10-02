import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { signalFixture } from "@/lib/marketing/research/__tests__/semanticCalibrationFixtures";
import { MVP_RESEARCH_SOURCES } from "@/lib/marketing/research/collectors/config";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { buildAgendaCandidateFromBrief } from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { buildResearchBriefFromCluster } from "@/lib/marketing/research/services/briefBuilder";
import {
  CURATION_DIVERSITY_MAX_PER_FAMILY,
  CURATION_DIVERSITY_MAX_PER_SOURCE,
  diversifyAgendaCandidatesForCurationWithStats,
  type CurationDiversityFillStats,
} from "@/lib/marketing/research/services/diversifyAgendaCandidatesForCuration";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

type Item = { id: string; source: string; family: string; outbound: number; credible: boolean };

const accessors = {
  getId: (item: Item) => item.id,
  getSourceKey: (item: Item) => item.source,
  getFamilyKey: (item: Item) => item.family,
  getOutboundScore: (item: Item) => item.outbound,
  isCredible: (item: Item) => item.credible,
};

function item(id: string, source: string, family = `family:${id}`, extra: Partial<Item> = {}): Item {
  return { id, source, family, outbound: 0.9, credible: true, ...extra };
}

/** `perSource` items per source, ranked source-block by source-block (A1..An, B1..Bn, …). */
function blockRanked(sources: string[], perSource: number, family?: (source: string, n: number) => string): Item[] {
  return sources.flatMap((source) =>
    Array.from({ length: perSource }, (_, i) =>
      item(`${source}${i + 1}`, source, family ? family(source, i + 1) : `family:${source}${i + 1}`),
    ),
  );
}

function run(ranked: Item[], limit: number) {
  const { picked, stats } = diversifyAgendaCandidatesForCurationWithStats(ranked, accessors, { limit });
  return { picked, stats, ids: picked.map((p) => p.id) };
}

function countBy(items: Item[], key: (i: Item) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) out[key(i)] = (out[key(i)] ?? 0) + 1;
  return out;
}

/** Replays selections: every staged pick must keep its source AND family within the stage cap. */
function expectStageCapsRespected(ranked: Item[], stats: CurationDiversityFillStats) {
  const byId = new Map(ranked.map((i) => [i.id, i]));
  const sourceCount = new Map<string, number>();
  const familyCount = new Map<string, number>();
  for (const sel of stats.selections) {
    const it = byId.get(sel.id)!;
    sourceCount.set(it.source, (sourceCount.get(it.source) ?? 0) + 1);
    familyCount.set(it.family, (familyCount.get(it.family) ?? 0) + 1);
    if (sel.stage === "staged_cap_relaxation") {
      expect(sel.relaxedCap).not.toBeNull();
      expect(sourceCount.get(it.source)!).toBeLessThanOrEqual(sel.relaxedCap!);
      expect(familyCount.get(it.family)!).toBeLessThanOrEqual(sel.relaxedCap!);
    }
  }
}

/** Pre-change behaviour (Pass 1 / 1b / one-shot uncapped Pass 2 / Pass 3), for parity checks. */
function legacyDiversify(ranked: Item[], limit: number): string[] {
  const picked: Item[] = [];
  const ids = new Set<string>();
  const sc = new Map<string, number>();
  const fc = new Map<string, number>();
  const pick = (i: Item) => {
    if (ids.has(i.id)) return;
    picked.push(i);
    ids.add(i.id);
    sc.set(i.source, (sc.get(i.source) ?? 0) + 1);
    fc.set(i.family, (fc.get(i.family) ?? 0) + 1);
  };
  const underCap = (i: Item) =>
    (sc.get(i.source) ?? 0) < CURATION_DIVERSITY_MAX_PER_SOURCE &&
    (fc.get(i.family) ?? 0) < CURATION_DIVERSITY_MAX_PER_FAMILY;
  for (const i of ranked) {
    if (picked.length >= limit) break;
    if (!i.credible) continue;
    if (!underCap(i)) {
      if (ranked.some((o) => !ids.has(o.id) && o.credible && underCap(o))) continue;
      break;
    }
    pick(i);
  }
  if (picked.length < limit && fc.size < 3) {
    for (const i of ranked) {
      if (picked.length >= limit) break;
      if (i.credible && underCap(i)) pick(i);
    }
  }
  for (const i of ranked) {
    if (picked.length >= limit) break;
    if (i.credible) pick(i);
  }
  for (const i of ranked) {
    if (picked.length >= limit) break;
    if (i.outbound >= 0.28) pick(i);
  }
  return picked.map((p) => p.id);
}

const FIVE = ["A", "B", "C", "D", "E"];

describe("staged diversity fill (Pass 2 cap relaxation)", () => {
  it("1. Pass 1 keeps at most 2 per source with 5 sources × plenty of candidates", () => {
    const ranked = blockRanked(FIVE, 6);
    const { stats, picked } = run(ranked, 18);
    expect(stats.pass1Picked).toBe(10);
    const pass1 = picked.slice(0, stats.pass1Picked);
    expect(Object.values(countBy(pass1, (i) => i.source)).every((n) => n === 2)).toBe(true);
  });

  it("2/3. below limit, the cap-3 stage fills first and cap 4 is not used when cap 3 suffices", () => {
    const ranked = blockRanked(FIVE, 6);
    const { stats, picked } = run(ranked, 15);
    expect(picked).toHaveLength(15);
    expect(stats.pass1Picked).toBe(10);
    expect(stats.stagedFillPicked).toBe(5);
    expect(stats.maxRelaxedCapUsed).toBe(3);
    expect(stats.selections.filter((s) => s.stage === "staged_cap_relaxation").every((s) => s.relaxedCap === 3)).toBe(true);
    expect(Object.values(countBy(picked, (i) => i.source)).every((n) => n === 3)).toBe(true);
  });

  it("4. when cap 3 is not enough, the cap-4 stage continues", () => {
    const ranked = blockRanked(FIVE, 6);
    const { stats, picked } = run(ranked, 18);
    expect(picked).toHaveLength(18);
    expect(stats.maxRelaxedCapUsed).toBe(4);
    const caps = stats.selections.filter((s) => s.stage === "staged_cap_relaxation").map((s) => s.relaxedCap);
    expect(caps).toEqual([3, 3, 3, 3, 3, 4, 4, 4]);
    expect(countBy(picked, (i) => i.source)).toEqual({ A: 4, B: 4, C: 4, D: 3, E: 3 });
    expect(stats.unrestrictedFillPicked).toBe(0);
  });

  it("5. staged picks respect both the source and the family stage cap", () => {
    // A and B share one destination family; C/D/E are spread out.
    const ranked = blockRanked(FIVE, 6, (s, n) => (s === "A" || s === "B" ? "destination:vietnam" : `family:${s}${n}`));
    const { stats, picked } = run(ranked, 18);
    expect(picked).toHaveLength(18);
    expectStageCapsRespected(ranked, stats);
    const families = countBy(picked, (i) => i.family);
    expect(families["destination:vietnam"]).toBeLessThanOrEqual(stats.maxRelaxedCapUsed!);
  });

  it("6. a source that must reach 6+ grows one stage at a time", () => {
    const ranked = [...blockRanked(["A"], 10), ...blockRanked(["B", "C"], 2)];
    const { stats, picked } = run(ranked, 12);
    expect(picked).toHaveLength(12);
    const aStaged = stats.selections
      .filter((s) => s.stage === "staged_cap_relaxation")
      .map((s) => s.relaxedCap);
    expect(aStaged).toEqual([3, 4, 5, 6, 7, 8]);
    expect(stats.maxRelaxedCapUsed).toBe(8);
    expectStageCapsRespected(ranked, stats);
  });

  it("7. with enough diversity the result is identical to the previous algorithm", () => {
    const ranked = blockRanked(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"], 3);
    const { ids, stats } = run(ranked, 18);
    expect(stats.stagedFillPicked).toBe(0);
    expect(ids).toEqual(legacyDiversify(ranked, 18));
  });

  it("8. a single source still fills up to the limit", () => {
    const ranked = blockRanked(["A"], 20);
    const { ids, stats } = run(ranked, 18);
    expect(ids).toEqual(ranked.slice(0, 18).map((i) => i.id));
    expect(stats.pass1Picked).toBe(2);
    expect(stats.stagedFillPicked).toBe(16);
    expect(stats.maxRelaxedCapUsed).toBe(18);
  });

  it("9. a single family still fills up to the limit, spreading sources evenly", () => {
    const ranked = blockRanked(["A", "B", "C", "D"], 6, () => "destination:japan");
    const { picked, stats } = run(ranked, 18);
    expect(picked).toHaveLength(18);
    expectStageCapsRespected(ranked, stats);
    const sources = Object.values(countBy(picked, (i) => i.source));
    expect(Math.max(...sources) - Math.min(...sources)).toBeLessThanOrEqual(1);
  });

  it("10. fewer credible candidates than the limit → all of them are used", () => {
    const ranked = blockRanked(["A", "B", "C"], 2);
    const { picked, stats } = run(ranked, 18);
    expect(picked).toHaveLength(6);
    expect(stats.weakFallbackPicked).toBe(0);
  });

  it("11. weak-outbound fallback after credible candidates is unchanged", () => {
    const ranked = [
      item("w1", "A", "f-w1", { credible: false, outbound: 0.35 }),
      ...blockRanked(["A", "B"], 2),
      item("vw1", "C", "f-vw1", { credible: false, outbound: 0.1 }),
      item("w2", "C", "f-w2", { credible: false, outbound: 0.3 }),
    ];
    const { ids, stats } = run(ranked, 10);
    expect(ids).toEqual(["A1", "A2", "B1", "B2", "w1", "w2"]);
    expect(ids).toEqual(legacyDiversify(ranked, 10));
    expect(stats.weakFallbackPicked).toBe(2);
    expect(stats.selections.slice(-2).every((s) => s.stage === "weak_outbound_fallback")).toBe(true);
  });

  it("12. inside a stage, equally represented sources keep rank order and each source's best item goes first", () => {
    const ranked = blockRanked(FIVE, 6);
    const { stats } = run(ranked, 18);
    const staged = stats.selections.filter((s) => s.stage === "staged_cap_relaxation").map((s) => s.id);
    expect(staged).toEqual(["A3", "B3", "C3", "D3", "E3", "A4", "B4", "C4"]);
  });

  it("12b. a source left under-represented by family caps is served first in the next stage", () => {
    // B's items all share A's family, so B is blocked during Pass 1.
    const ranked = [
      ...blockRanked(["A"], 4, () => "destination:vietnam"),
      ...blockRanked(["B"], 4, () => "destination:vietnam"),
      ...blockRanked(["C", "D"], 4),
    ];
    const { stats } = run(ranked, 9);
    expect(stats.pass1Picked).toBe(6);
    const firstStaged = stats.selections.find((s) => s.stage === "staged_cap_relaxation");
    expect(firstStaged?.id).toBe("B1");
  });

  it("13. Pass 1 / 1b selections precede staged fill and the min-families exposure is kept", () => {
    const ranked = [
      ...blockRanked(["A"], 6, () => "destination:vietnam"),
      item("J1", "B", "destination:japan"),
      item("T1", "C", "destination:thailand"),
    ];
    const { stats, picked } = run(ranked, 8);
    expect(new Set(picked.map((i) => i.family)).size).toBe(3);
    const order = ["pass1_soft_cap", "pass1b_min_families", "staged_cap_relaxation", "unrestricted_credible_fill", "weak_outbound_fallback"];
    const stageIdx = stats.selections.map((s) => order.indexOf(s.stage));
    expect([...stageIdx].sort((a, b) => a - b)).toEqual(stageIdx);
    expect(picked.slice(0, 4).map((i) => i.id)).toEqual(["A1", "A2", "J1", "T1"]);
  });

  it("14. result size keeps the limit semantics", () => {
    const ranked = blockRanked(FIVE, 6);
    expect(run(ranked, 0).picked).toHaveLength(0);
    expect(run([], 18).picked).toHaveLength(0);
    expect(run(ranked, 7.9).picked).toHaveLength(7);
    expect(run(ranked, 18).picked).toHaveLength(18);
    expect(run(ranked, 100).picked).toHaveLength(30);
    expect(new Set(run(ranked, 30).ids).size).toBe(30);
  });

  it("stats counters add up to the selection list", () => {
    const ranked = [...blockRanked(FIVE, 4), item("w", "Z", "f-w", { credible: false, outbound: 0.5 })];
    const { stats, picked } = run(ranked, 25);
    expect(stats.selections.map((s) => s.id)).toEqual(picked.map((p) => p.id));
    expect(
      stats.pass1Picked + stats.pass1bPicked + stats.stagedFillPicked + stats.unrestrictedFillPicked + stats.weakFallbackPicked,
    ).toBe(picked.length);
    expect(stats.weakFallbackPicked).toBe(1);
  });
});

describe("MM research context exposes curation diversity fill observability", () => {
  const NOW = new Date("2026-09-02T12:00:00.000Z");
  const SOURCES: ResearchSource[] = MVP_RESEARCH_SOURCES.map((s) => ({
    ...s,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  }));

  it("reports pass counts plus source/family mix without touching notes", async () => {
    const repo = createInMemoryResearchRepository(SOURCES);
    const sources = new Map(SOURCES.map((s) => [s.id, s]));
    const destinations = ["japan", "vietnam", "thailand", "france"];
    for (let n = 1; n <= 12; n += 1) {
      const source = SOURCES[n % SOURCES.length]!;
      const destination = destinations[n % destinations.length]!;
      const signal = await repo.upsertSignal(
        signalFixture({
          id: `00000001-0000-4000-8000-${n.toString(16).padStart(12, "0")}`,
          title: `${destination} travel update ${n}`,
          summary: `Travel update ${n} for ${destination}.`,
          signalType: "general_travel_news",
          sourceId: source.id,
          sourceType: source.sourceType,
          destinations: [destination],
          canonicalUrl: `https://news.example/${n}`,
          rawFingerprint: `article-${n}`,
          normalizedFingerprint: `article-${n}-n`,
          evidence: [
            {
              id: `ev-${n}`,
              sourceId: source.id,
              url: `https://news.example/${n}`,
              excerpt: `Travel update ${n}.`,
              observedAt: NOW.toISOString(),
              evidenceType: "direct_source",
            },
          ],
        }),
      );
      const brief = buildResearchBriefFromCluster({
        cluster: {
          id: `00000002-0000-4000-8000-${n.toString(16).padStart(12, "0")}`,
          primarySignalId: signal.id,
          signalIds: [signal.id],
          clusterType: "destination_group",
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
        signals: [signal],
        sources,
        now: NOW,
      })!;
      await repo.upsertBrief(brief);
      await repo.upsertAgendaCandidate({
        ...buildAgendaCandidateFromBrief(brief, NOW),
        id: `00000003-0000-4000-8000-${n.toString(16).padStart(12, "0")}`,
        compositeResearchScore: 0.5 + n * 0.01,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      });
    }

    const context = await getMarketingManagerResearchContext(
      {},
      { repo, now: NOW, checkSemanticInfrastructure: async () => true },
    );
    const fill = context.observability.curationDiversityFill;
    expect(context.agendaCandidates.length).toBeGreaterThan(0);
    expect(fill).toBeDefined();
    expect(
      fill!.pass1Picked + fill!.pass1bPicked + fill!.stagedFillPicked + fill!.unrestrictedFillPicked + fill!.weakFallbackPicked,
    ).toBe(context.agendaCandidates.length);
    expect(Object.values(fill!.sourceCounts).reduce((a, b) => a + b, 0)).toBe(context.agendaCandidates.length);
    expect(Object.values(fill!.familyCounts).reduce((a, b) => a + b, 0)).toBe(context.agendaCandidates.length);
    expect(context.notes.some((n) => /staged|relaxed|pass1/i.test(n))).toBe(false);
  });
});
