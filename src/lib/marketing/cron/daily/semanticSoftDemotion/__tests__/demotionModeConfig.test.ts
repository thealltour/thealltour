vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import {
  applyResearchIdentityCooldown,
} from "@/lib/marketing/cron/daily/researchIdentityCooldown";
import {
  DEFAULT_MARKETING_SEMANTIC_DEMOTION_MODE,
  resolveMarketingSemanticDemotionMode,
  resolveSemanticDemotionModeFromDeps,
  runSemanticSoftDemotion,
  SEMANTIC_DEMOTION_STRONG,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion";
import { computeCorroborationSignals } from "@/lib/marketing/cron/daily/semanticSoftDemotion/corroboration";
import { isVerificationResearchArtifact } from "@/lib/marketing/research/manager/isVerificationResearchArtifact";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import {
  MARKETING_RESEARCH_CONTEXT_CONTRACT,
  type MarketingResearchContext,
} from "@/lib/marketing/research/manager/types";
import type { EmbeddingVector } from "@/lib/marketing/semantic/types";
import { STEP_3_9_VERIFICATION_PURPOSE } from "@/lib/marketing/operations/verification";

function unit(values: number[]): EmbeddingVector {
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0)) || 1;
  return values.map((v) => v / norm);
}

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

function qualifyingPair() {
  const [e1, e2] = pairAtSimilarity(0.9);
  const a = candidate({
    agendaCandidateId: "ac_a",
    researchBriefId: "rb_a",
    title: "Same event update one with many shared tokens here",
    totalResearchScore: 0.9,
    evidence: [evidence({ evidenceId: "e1", sourceId: "s1", sourceName: "A", url: "https://a.ex/1" })],
  });
  const b = candidate({
    agendaCandidateId: "ac_b",
    researchBriefId: "rb_b",
    title: "Same event update two with many shared tokens here",
    totalResearchScore: 0.89,
    evidence: [evidence({ evidenceId: "e2", sourceId: "s2", sourceName: "B", url: "https://b.ex/2" })],
  });
  return {
    context: contextFrom([a, b]),
    embeddings: new Map([
      ["rb_a", e1],
      ["rb_b", e2],
    ]),
  };
}

describe("STEP E-4H semantic demotion activation gate", () => {
  it("1. env unset => shadow", () => {
    expect(resolveMarketingSemanticDemotionMode({})).toBe("shadow");
    expect(DEFAULT_MARKETING_SEMANTIC_DEMOTION_MODE).toBe("shadow");
  });

  it("2. env blank => shadow", () => {
    expect(resolveMarketingSemanticDemotionMode({ MARKETING_SEMANTIC_DEMOTION_MODE: "" })).toBe(
      "shadow",
    );
    expect(resolveMarketingSemanticDemotionMode({ MARKETING_SEMANTIC_DEMOTION_MODE: "   " })).toBe(
      "shadow",
    );
  });

  it("3. env invalid => shadow", () => {
    expect(resolveMarketingSemanticDemotionMode({ MARKETING_SEMANTIC_DEMOTION_MODE: "prod" })).toBe(
      "shadow",
    );
    expect(resolveMarketingSemanticDemotionMode({ MARKETING_SEMANTIC_DEMOTION_MODE: "TRUE" })).toBe(
      "shadow",
    );
  });

  it("accepts off/shadow/live with case normalization", () => {
    expect(resolveMarketingSemanticDemotionMode({ MARKETING_SEMANTIC_DEMOTION_MODE: "off" })).toBe(
      "off",
    );
    expect(resolveMarketingSemanticDemotionMode({ MARKETING_SEMANTIC_DEMOTION_MODE: "SHADOW" })).toBe(
      "shadow",
    );
    expect(resolveMarketingSemanticDemotionMode({ MARKETING_SEMANTIC_DEMOTION_MODE: " Live " })).toBe(
      "live",
    );
  });

  it("4. off => no score mutation and no semantic work side effects", async () => {
    const { context, embeddings } = qualifyingPair();
    const before = context.agendaCandidates.map((c) => c.totalResearchScore);
    const result = await runSemanticSoftDemotion(context, {
      mode: "off",
      embeddingsByBriefId: embeddings,
    });
    expect(result.mode).toBe("off");
    expect(result.report.comparedCount).toBe(0);
    expect(result.report.hypotheticalDemotedCount).toBe(0);
    expect(result.report.appliedDemotedCount).toBe(0);
    expect(result.context.agendaCandidates.map((c) => c.totalResearchScore)).toEqual(before);
  });

  it("5/7/8. shadow => diagnostics computed but no score mutation; applied=0", async () => {
    const { context, embeddings } = qualifyingPair();
    const beforeScores = context.agendaCandidates.map((c) => c.totalResearchScore);
    const beforeOrder = context.agendaCandidates.map((c) => c.agendaCandidateId);
    const result = await runSemanticSoftDemotion(context, {
      mode: "shadow",
      embeddingsByBriefId: embeddings,
    });
    expect(result.mode).toBe("shadow");
    expect(result.report.hypotheticalDemotedCount).toBeGreaterThan(0);
    expect(result.report.appliedDemotedCount).toBe(0);
    expect(result.context.agendaCandidates.map((c) => c.totalResearchScore)).toEqual(beforeScores);
    expect(result.context.agendaCandidates.map((c) => c.agendaCandidateId)).toEqual(beforeOrder);
  });

  it("6/9. live => expected soft demotion applied; applied count correct", async () => {
    const { context, embeddings } = qualifyingPair();
    const beforeB = context.agendaCandidates[1]!.totalResearchScore;
    const result = await runSemanticSoftDemotion(context, {
      mode: "live",
      embeddingsByBriefId: embeddings,
    });
    expect(result.mode).toBe("live");
    expect(result.report.hypotheticalDemotedCount).toBe(1);
    expect(result.report.appliedDemotedCount).toBe(1);
    const afterB = result.context.agendaCandidates.find((c) => c.agendaCandidateId === "ac_b")!;
    expect(afterB.totalResearchScore).toBeCloseTo(beforeB * (1 - SEMANTIC_DEMOTION_STRONG), 5);
    expect(afterB.scoreReasons.some((r) => r.startsWith("semantic_soft_demoted_"))).toBe(true);
  });

  it("env live without deps.mode applies when resolved from env", async () => {
    const { context, embeddings } = qualifyingPair();
    const result = await runSemanticSoftDemotion(context, {
      env: { MARKETING_SEMANTIC_DEMOTION_MODE: "live" },
      embeddingsByBriefId: embeddings,
    });
    expect(result.mode).toBe("live");
    expect(result.report.appliedDemotedCount).toBe(1);
  });

  it("shadowOnly deprecated flag still forces shadow", () => {
    expect(resolveSemanticDemotionModeFromDeps({ shadowOnly: true })).toBe("shadow");
  });

  it("10. semantic repo failure still preserves Agenda flow", async () => {
    const { context } = qualifyingPair();
    const before = context.agendaCandidates.map((c) => c.totalResearchScore);
    const result = await runSemanticSoftDemotion(context, {
      mode: "live",
      loadError: "relation marketing_semantic_embeddings does not exist",
    });
    expect(result.report.degraded).toBe(true);
    expect(result.report.appliedDemotedCount).toBe(0);
    expect(result.context.agendaCandidates.map((c) => c.totalResearchScore)).toEqual(before);
  });

  it("11. verification fixture remains filtered by E-4G helper", () => {
    expect(
      isVerificationResearchArtifact({
        title: "performance: [verification] step 3-9 performance feedback wiring",
        signal: {
          id: "sig",
          sourceId: "src",
          sourceType: "performance_memory",
          signalType: "content_performance",
          title: "performance: [verification] step 3-9",
          summary: "x",
          evidence: [],
          geography: [],
          destinations: [],
          topics: [],
          entities: [],
          language: "ko",
          rawFingerprint: "x",
          observedAt: "2026-09-02T00:00:00.000Z",
          status: "observed",
          createdAt: "2026-09-02T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
          metadata: {
            purpose: STEP_3_9_VERIFICATION_PURPOSE,
            candidateId: "cmc_step_3_9_verification",
          },
        },
      }),
    ).toBe(true);
    expect(
      isVerificationResearchArtifact({
        title: "Visa verification checklist for outbound travelers",
        signal: null,
      }),
    ).toBe(false);
  });

  it("12. VN autumn context-only case remains penalty 0", async () => {
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
          sourceId: "vn",
          sourceName: "Vietnam Tourism",
          url: "https://vn.example/a",
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
          sourceId: "vn",
          sourceName: "Vietnam Tourism",
          url: "https://vn.example/b",
        }),
      ],
    });
    expect(computeCorroborationSignals(a, b).hasContentCorroboration).toBe(false);
    const live = await runSemanticSoftDemotion(contextFrom([a, b]), {
      mode: "live",
      embeddingsByBriefId: new Map([
        ["rb_a", e1],
        ["rb_b", e2],
      ]),
    });
    expect(live.report.hypotheticalDemotedCount).toBe(0);
    expect(live.report.appliedDemotedCount).toBe(0);
    expect(live.context.agendaCandidates[1]!.totalResearchScore).toBe(0.85);
  });

  it("13. exact cooldown semantics unchanged", () => {
    const a = candidate({
      agendaCandidateId: "ac_keep",
      researchBriefId: "rb_keep",
      title: "Alpha unique",
      totalResearchScore: 0.9,
      evidence: [
        evidence({
          evidenceId: "e1",
          sourceId: "s1",
          sourceName: "NYT",
          url: "https://example.com/keep-article",
        }),
      ],
    });
    const b = candidate({
      agendaCandidateId: "ac_cool",
      researchBriefId: "rb_cool",
      title: "Beta cooled",
      totalResearchScore: 0.8,
      evidence: [
        evidence({
          evidenceId: "e2",
          sourceId: "s1",
          sourceName: "NYT",
          url: "https://example.com/cooled-article?utm_source=x",
        }),
      ],
    });
    const cooled = applyResearchIdentityCooldown(contextFrom([a, b]), {
      agendaCandidateIds: new Set(),
      researchBriefIds: new Set(),
      sourceArticleIds: new Set(["https://example.com/cooled-article"]),
    });
    expect(cooled.excludedAgendaCandidateIds).toContain("ac_cool");
    expect(cooled.excludedAgendaCandidateIds).not.toContain("ac_keep");
    expect(cooled.context.agendaCandidates.map((c) => c.agendaCandidateId)).toEqual(["ac_keep"]);
  });
});
