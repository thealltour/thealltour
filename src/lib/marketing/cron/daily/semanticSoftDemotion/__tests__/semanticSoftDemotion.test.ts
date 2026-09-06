vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import {
  applySemanticDemotion,
  computeCorroborationSignals,
  computeSemanticDemotion,
  destinationsOverlapOnly,
  normalizeAgendaTitleFingerprint,
  resolveDemotionAmount,
  resolveSemanticBand,
  runSemanticSoftDemotion,
  SEMANTIC_DEMOTION_STRONG,
  SEMANTIC_DEMOTION_WEAK,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import {
  MARKETING_RESEARCH_CONTEXT_CONTRACT,
  type MarketingResearchContext,
} from "@/lib/marketing/research/manager/types";
import type { EmbeddingVector } from "@/lib/marketing/semantic/types";

function unit(values: number[]): EmbeddingVector {
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0)) || 1;
  return values.map((v) => v / norm);
}

/** Build two nearly-aligned 8-d vectors with approximate cosine `target`. */
function pairAtSimilarity(target: number): [EmbeddingVector, EmbeddingVector] {
  const a = unit([1, 0, 0, 0, 0, 0, 0, 0]);
  const t = Math.max(-1, Math.min(1, target));
  const b = unit([t, Math.sqrt(Math.max(0, 1 - t * t)), 0, 0, 0, 0, 0, 0]);
  return [a, b];
}

function evidence(
  overrides: Partial<NonNullable<CompactManagerAgendaCandidate["evidence"]>[number]> & {
    evidenceId: string;
    sourceId: string;
    sourceName: string;
    url: string;
  },
): NonNullable<CompactManagerAgendaCandidate["evidence"]>[number] {
  return {
    sourceType: "news",
    isOfficial: false,
    evidenceType: "article",
    reference: null,
    excerpt: null,
    publishedAt: overrides.publishedAt ?? "2026-09-04T00:00:00.000Z",
    observedAt: overrides.observedAt ?? "2026-09-04T00:00:00.000Z",
    ...overrides,
  };
}

function candidate(
  overrides: Partial<CompactManagerAgendaCandidate> & {
    agendaCandidateId: string;
    researchBriefId: string;
    title: string;
  },
): CompactManagerAgendaCandidate {
  return {
    summary: overrides.summary ?? overrides.title,
    destinations: overrides.destinations ?? [],
    topics: overrides.topics ?? ["travel"],
    entities: [],
    signalTypes: [],
    publishedAt: overrides.publishedAt ?? "2026-09-04T00:00:00.000Z",
    observedAt: overrides.observedAt ?? "2026-09-04T00:00:00.000Z",
    freshnessScore: 0.8,
    credibilityScore: 0.8,
    travelRelevanceScore: 0.8,
    publicInterestScore: 0.7,
    commercialRelevanceScore: 0.5,
    seasonalityScore: 0.5,
    corroborationScore: 0.5,
    noveltyScore: 0.5,
    koreanOutboundRelevanceScore: 0.7,
    totalResearchScore: overrides.totalResearchScore ?? 0.8,
    researchScoreComponents: null,
    scoreReasons: overrides.scoreReasons ?? ["freshness_0.80"],
    riskFlags: overrides.riskFlags ?? [],
    matchedProductIds: [],
    evidence: overrides.evidence ?? [],
    candidateStatus: "candidate",
    ...overrides,
  };
}

function contextFrom(candidates: CompactManagerAgendaCandidate[]): MarketingResearchContext {
  return {
    contract: MARKETING_RESEARCH_CONTEXT_CONTRACT,
    status: "ok",
    generatedAt: "2026-09-04T00:00:00.000Z",
    window: {
      lookbackHours: 48,
      since: "2026-09-02T00:00:00.000Z",
      until: "2026-09-04T00:00:00.000Z",
    },
    agendaCandidates: candidates,
    briefs: [],
    sourceSummary: {
      officialSourceCount: 0,
      newsSourceCount: 1,
      independentSourceFamilies: 1,
      evidenceCount: candidates.length,
    },
    degradedState: null,
    observability: {
      requestedAt: "2026-09-04T00:00:00.000Z",
      candidateCount: candidates.length,
      briefCount: 0,
      topScore: candidates[0]?.totalResearchScore ?? null,
      degraded: false,
      staleExcludedCount: 0,
      duplicateExcludedCount: 0,
    },
    notes: [],
  };
}

function decisionFor(
  report: ReturnType<typeof computeSemanticDemotion>,
  agendaCandidateId: string,
) {
  return report.decisions.find((d) => d.agendaCandidateId === agendaCandidateId)!;
}

describe("STEP E-4F semantic soft demotion corroboration gate", () => {
  it("1. sim 0.727 + same source only => penalty 0", () => {
    const [e1, e2] = pairAtSimilarity(0.727);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "chasing gold and clouds vietnam best september escapes",
      destinations: ["vietnam"],
      topics: ["festival"],
      totalResearchScore: 0.9,
      publishedAt: "2026-08-01T00:00:00.000Z",
      evidence: [
        evidence({
          evidenceId: "e1",
          sourceId: "vn_rss",
          sourceName: "Vietnam Tourism",
          url: "https://vn.example/autumn-a",
        }),
      ],
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "enjoy early autumn in northern vietnam hills",
      destinations: ["vietnam"],
      topics: ["nature"],
      totalResearchScore: 0.85,
      publishedAt: "2026-09-04T00:00:00.000Z",
      evidence: [
        evidence({
          evidenceId: "e2",
          sourceId: "vn_rss",
          sourceName: "Vietnam Tourism",
          url: "https://vn.example/autumn-b",
        }),
      ],
    });
    const breakdown = computeCorroborationSignals(a, b);
    expect(breakdown.contextSignals).toContain("source_family_same");
    expect(breakdown.hasContentCorroboration).toBe(false);
    const report = computeSemanticDemotion({
      candidates: [a, b],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    const d = decisionFor(report, "ac_b");
    expect(d.semanticBand).toBe("near_duplicate_candidate");
    expect(d.demotionAmount).toBe(0);
    expect(d.contentCorroborators).toEqual([]);
  });

  it("2. sim 0.78 + same series/template only => penalty 0", () => {
    const [e1, e2] = pairAtSimilarity(0.78);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "후지산과 예술 섬 [일본 소도시 이야기 ①]",
      totalResearchScore: 0.9,
      publishedAt: "2026-09-01T00:00:00.000Z",
      evidence: [
        evidence({
          evidenceId: "e1",
          sourceId: "travie",
          sourceName: "트래비 Travie",
          url: "https://travie.example/1",
          publishedAt: "2026-09-01T00:00:00.000Z",
        }),
      ],
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "요즘 주목받는 온천마을 [일본 소도시 이야기 ②]",
      totalResearchScore: 0.88,
      publishedAt: "2026-09-04T00:00:00.000Z",
      evidence: [
        evidence({
          evidenceId: "e2",
          sourceId: "travie",
          sourceName: "트래비 Travie",
          url: "https://travie.example/2",
        }),
      ],
    });
    const breakdown = computeCorroborationSignals(a, b);
    expect(breakdown.contextSignals).toContain("series_template_hint");
    expect(breakdown.contextSignals).toContain("source_family_same");
    expect(breakdown.hasContentCorroboration).toBe(false);
    const report = computeSemanticDemotion({
      candidates: [a, b],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    expect(decisionFor(report, "ac_b").demotionAmount).toBe(0);
  });

  it("3. sim 0.70 + same destination only => penalty 0", () => {
    const [e1, e2] = pairAtSimilarity(0.7);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "Hanoi street food night markets",
      destinations: ["vietnam"],
      topics: ["food"],
      publishedAt: "2026-08-01T00:00:00.000Z",
      evidence: [evidence({ evidenceId: "e1", sourceId: "s1", sourceName: "A", url: "https://a.ex/1" })],
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "Da Nang beach resort openings",
      destinations: ["vietnam"],
      topics: ["beach"],
      publishedAt: "2026-09-04T00:00:00.000Z",
      evidence: [evidence({ evidenceId: "e2", sourceId: "s2", sourceName: "B", url: "https://b.ex/2" })],
    });
    expect(destinationsOverlapOnly(a, b)).toBe(true);
    const breakdown = computeCorroborationSignals(a, b);
    expect(breakdown.contextSignals).toContain("destination_overlap_only");
    expect(breakdown.hasContentCorroboration).toBe(false);
    const report = computeSemanticDemotion({
      candidates: [a, b],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    expect(decisionFor(report, "ac_b").demotionAmount).toBe(0);
  });

  it("4. sim 0.70 + date proximity only => penalty 0", () => {
    const [e1, e2] = pairAtSimilarity(0.7);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "Kenya safari lodge update",
      destinations: ["kenya"],
      topics: ["safari"],
      publishedAt: "2026-09-03T00:00:00.000Z",
      evidence: [evidence({ evidenceId: "e1", sourceId: "s1", sourceName: "A", url: "https://a.ex/1" })],
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "Nepal trekking permit change",
      destinations: ["nepal"],
      topics: ["trekking"],
      publishedAt: "2026-09-04T00:00:00.000Z",
      evidence: [evidence({ evidenceId: "e2", sourceId: "s2", sourceName: "B", url: "https://b.ex/2" })],
    });
    const breakdown = computeCorroborationSignals(a, b);
    expect(breakdown.contextSignals).toContain("date_proximity");
    expect(breakdown.hasContentCorroboration).toBe(false);
    const report = computeSemanticDemotion({
      candidates: [a, b],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    expect(decisionFor(report, "ac_b").demotionAmount).toBe(0);
  });

  it("5. sim 0.80 + meaningful title overlap => soft penalty", () => {
    const [e1, e2] = pairAtSimilarity(0.8);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "티웨이항공 간판 내린다 트리니티항공 데뷔 항공기",
      totalResearchScore: 0.9,
      evidence: [evidence({ evidenceId: "e1", sourceId: "s1", sourceName: "여행신문", url: "https://a.ex/1" })],
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "트리니티항공 신규 리버리 적용 항공기 도입 티웨이항공",
      totalResearchScore: 0.88,
      evidence: [evidence({ evidenceId: "e2", sourceId: "s2", sourceName: "트래블데일리", url: "https://b.ex/2" })],
    });
    const breakdown = computeCorroborationSignals(a, b);
    expect(breakdown.contentCorroborators).toContain("title_token_overlap");
    const report = computeSemanticDemotion({
      candidates: [a, b],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    const d = decisionFor(report, "ac_b");
    expect(d.demotionAmount).toBeGreaterThan(0);
    expect(d.demotionAmount).toBeLessThanOrEqual(0.12);
    expect(d.contentCorroborators).toContain("title_token_overlap");
  });

  it("6. sim 0.70 + destination/topic + close date => eligible soft penalty", () => {
    const [e1, e2] = pairAtSimilarity(0.7);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "Alpha lodge opening ceremony",
      destinations: ["vietnam"],
      topics: ["hotel"],
      publishedAt: "2026-09-03T00:00:00.000Z",
      evidence: [evidence({ evidenceId: "e1", sourceId: "s1", sourceName: "A", url: "https://a.ex/1" })],
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "Beta resort ribbon cutting",
      destinations: ["vietnam"],
      topics: ["hotel"],
      publishedAt: "2026-09-04T00:00:00.000Z",
      evidence: [evidence({ evidenceId: "e2", sourceId: "s2", sourceName: "B", url: "https://b.ex/2" })],
    });
    const breakdown = computeCorroborationSignals(a, b);
    expect(breakdown.contentCorroborators).toContain("destination_topic_and_date");
    expect(
      resolveDemotionAmount({
        band: resolveSemanticBand(0.7),
        breakdown,
      }).amount,
    ).toBeGreaterThan(0);
    const report = computeSemanticDemotion({
      candidates: [a, b],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    expect(decisionFor(report, "ac_b").demotionAmount).toBeGreaterThan(0);
  });

  it("7. sim 0.90 + same source only => penalty 0", () => {
    const [e1, e2] = pairAtSimilarity(0.9);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "Completely different alpha subject matter",
      publishedAt: "2026-01-01T00:00:00.000Z",
      evidence: [
        evidence({
          evidenceId: "e1",
          sourceId: "same",
          sourceName: "SamePaper",
          url: "https://same.ex/1",
          publishedAt: "2026-01-01T00:00:00.000Z",
        }),
      ],
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "Utterly unrelated omega topic area",
      publishedAt: "2026-09-04T00:00:00.000Z",
      evidence: [
        evidence({
          evidenceId: "e2",
          sourceId: "same",
          sourceName: "SamePaper",
          url: "https://same.ex/2",
        }),
      ],
    });
    const breakdown = computeCorroborationSignals(a, b);
    expect(breakdown.contextSignals).toContain("source_family_same");
    expect(breakdown.hasContentCorroboration).toBe(false);
    const report = computeSemanticDemotion({
      candidates: [a, b],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    const d = decisionFor(report, "ac_b");
    expect(d.semanticBand).toBe("strong_duplicate_candidate");
    expect(d.demotionAmount).toBe(0);
  });

  it("8. sim 0.90 + meaningful content corroboration => strong soft penalty", () => {
    const [e1, e2] = pairAtSimilarity(0.9);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "Same event update one with many shared tokens here",
      totalResearchScore: 0.9,
      evidence: [evidence({ evidenceId: "e1", sourceId: "s1", sourceName: "Paper", url: "https://p.ex/1" })],
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "Same event update two with many shared tokens here",
      totalResearchScore: 0.89,
      evidence: [evidence({ evidenceId: "e2", sourceId: "s2", sourceName: "Other", url: "https://p.ex/2" })],
    });
    const report = computeSemanticDemotion({
      candidates: [a, b],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    const d = decisionFor(report, "ac_b");
    expect(d.contentCorroborators.length).toBeGreaterThan(0);
    expect(d.demotionAmount).toBe(SEMANTIC_DEMOTION_STRONG);
    const applied = applySemanticDemotion(contextFrom([a, b]), report);
    expect(applied.context.agendaCandidates).toHaveLength(2);
  });

  it("9. exact URL/title duplicate remains deterministic, not semantic demotion", () => {
    const [e1, e2] = pairAtSimilarity(0.95);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "Kenya Travel Advice",
      totalResearchScore: 0.9,
      evidence: [
        evidence({
          evidenceId: "e1",
          sourceId: "src1",
          sourceName: "NYT",
          url: "https://example.com/story?utm_source=x",
        }),
      ],
    });
    const bUrl = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "Different wording entirely",
      totalResearchScore: 0.85,
      evidence: [
        evidence({
          evidenceId: "e2",
          sourceId: "src1",
          sourceName: "NYT",
          url: "https://example.com/story",
        }),
      ],
    });
    const urlReport = computeSemanticDemotion({
      candidates: [a, bUrl],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    const urlDecision = decisionFor(urlReport, "ac_b");
    expect(urlDecision.deterministicExactSignals).toContain("canonical_url_match");
    expect(urlDecision.demotionAmount).toBe(0);

    const bTitle = candidate({
      agendaCandidateId: "ac_c",
      researchBriefId: "rb_c",
      title: "kenya  travel   advice",
      totalResearchScore: 0.84,
      evidence: [evidence({ evidenceId: "e3", sourceId: "s2", sourceName: "Other", url: "https://other.ex/1" })],
    });
    expect(normalizeAgendaTitleFingerprint(a.title)).toBe(
      normalizeAgendaTitleFingerprint(bTitle.title),
    );
    const titleReport = computeSemanticDemotion({
      candidates: [a, bTitle],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_c", e2],
      ]),
    });
    const titleDecision = decisionFor(titleReport, "ac_c");
    expect(titleDecision.deterministicExactSignals).toContain("normalized_title_match");
    expect(titleDecision.demotionAmount).toBe(0);
  });

  it("10. Vietnam autumn festival vs Vietnam wellness remain distinct", () => {
    const [e1, e2] = pairAtSimilarity(0.72);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "Autumn festival in Hanoi",
      destinations: ["vietnam"],
      topics: ["festival"],
      publishedAt: "2026-08-01T00:00:00.000Z",
      evidence: [
        evidence({
          evidenceId: "e1",
          sourceId: "vn1",
          sourceName: "VN Tourism A",
          url: "https://vn.example/festival",
          publishedAt: "2026-08-01T00:00:00.000Z",
        }),
      ],
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "Wellness resorts near Da Nang",
      destinations: ["vietnam"],
      topics: ["wellness"],
      publishedAt: "2026-09-04T00:00:00.000Z",
      evidence: [
        evidence({
          evidenceId: "e2",
          sourceId: "vn2",
          sourceName: "VN Tourism B",
          url: "https://vn.example/wellness",
        }),
      ],
    });
    expect(destinationsOverlapOnly(a, b)).toBe(true);
    const report = computeSemanticDemotion({
      candidates: [a, b],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    expect(decisionFor(report, "ac_b").demotionAmount).toBe(0);
  });

  it("11. semantic unavailable / repository failure preserves prior behavior", async () => {
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "Only one",
      totalResearchScore: 0.9,
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "Missing vector peer",
      totalResearchScore: 0.88,
    });
    const missing = await runSemanticSoftDemotion(contextFrom([a, b]), {
      embeddingsByBriefId: new Map([["rb_a", unit([1, 0, 0, 0, 0, 0, 0, 0])]]),
    });
    expect(missing.context.agendaCandidates).toHaveLength(2);
    expect(missing.report.decisions.find((d) => d.agendaCandidateId === "ac_b")!.demotionAmount).toBe(0);

    const failed = await runSemanticSoftDemotion(contextFrom([a, b]), {
      loadError: "relation marketing_semantic_embeddings does not exist",
    });
    expect(failed.report.degraded).toBe(true);
    expect(failed.report.demotedCount).toBe(0);
    expect(failed.context.agendaCandidates.map((c) => c.agendaCandidateId)).toEqual(["ac_a", "ac_b"]);
    expect(failed.context.agendaCandidates[0]!.totalResearchScore).toBe(0.9);
  });

  it("12. no semantic hard rejection anywhere", () => {
    const [e1, e2] = pairAtSimilarity(0.95);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "Same event update one with many shared tokens here",
      totalResearchScore: 0.9,
      evidence: [evidence({ evidenceId: "e1", sourceId: "s1", sourceName: "Paper", url: "https://p.ex/1" })],
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "Same event update two with many shared tokens here",
      totalResearchScore: 0.89,
      evidence: [evidence({ evidenceId: "e2", sourceId: "s1", sourceName: "Paper", url: "https://p.ex/2" })],
    });
    const report = computeSemanticDemotion({
      candidates: [a, b],
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    expect(decisionFor(report, "ac_b").demotionAmount).toBe(SEMANTIC_DEMOTION_STRONG);
    const applied = applySemanticDemotion(contextFrom([a, b]), report);
    expect(applied.context.agendaCandidates).toHaveLength(2);
    expect(applied.context.agendaCandidates.every((c) => c.totalResearchScore >= 0)).toBe(true);
  });

  it("diagnostics distinguish content vs context; weak alone never demotes", () => {
    expect(
      resolveDemotionAmount({
        band: "near_duplicate_candidate",
        breakdown: {
          deterministicExactSignals: [],
          contentCorroborators: [],
          contextSignals: ["source_family_same", "series_template_hint"],
          titleJaccard: 0.1,
          hasContentCorroboration: false,
          hasStrongContentCorroboration: false,
        },
      }).amount,
    ).toBe(0);
    expect(SEMANTIC_DEMOTION_WEAK).toBe(0.05);
  });

  it("shadowOnly computes without mutating context scores", async () => {
    const [e1, e2] = pairAtSimilarity(0.9);
    const a = candidate({
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "Shared title tokens alpha beta gamma",
      totalResearchScore: 0.9,
      evidence: [evidence({ evidenceId: "e1", sourceId: "s1", sourceName: "A", url: "https://s.ex/1" })],
    });
    const b = candidate({
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "Shared title tokens alpha beta delta",
      totalResearchScore: 0.89,
      evidence: [evidence({ evidenceId: "e2", sourceId: "s2", sourceName: "B", url: "https://s.ex/2" })],
    });
    const before = contextFrom([a, b]);
    const shadow = await runSemanticSoftDemotion(before, {
      shadowOnly: true,
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    expect(shadow.context.agendaCandidates[1]!.totalResearchScore).toBe(0.89);
    expect(shadow.report.demotedCount).toBeGreaterThan(0);
  });
});
