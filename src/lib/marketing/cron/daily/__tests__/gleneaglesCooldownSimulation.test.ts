vi.mock("server-only", () => ({}));

/**
 * READ-ONLY fixture simulation — does not call production cron or mutate DB.
 * Given Gleneagles research identities used on 09-02 / 09-03 / 09-04 history,
 * today's selection must exclude that exact identity.
 */
import { describe, expect, it } from "vitest";

import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  applyResearchIdentityCooldown,
  collectRecentResearchIdentities,
} from "@/lib/marketing/cron/daily/researchIdentityCooldown";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { MarketingResearchContext } from "@/lib/marketing/research/manager/types";
import { MARKETING_RESEARCH_CONTEXT_CONTRACT } from "@/lib/marketing/research/manager/types";

const GLENEAGLES = {
  agendaCandidateId: "ac_gleneagles_scotland_golf",
  researchBriefId: "rb_gleneagles_scotland_golf",
  articleUrl: "https://example.com/news/gleneagles-scotland-golf-2026",
  statement: "Gleneagles remains a top Scotland golf destination for overseas travelers.",
};

function gleneaglesCandidate(businessDateKst: string): CompletedMarketingCandidate {
  const handoff = prepareManagerToContentHandoff(
    {
      title: "Gleneagles Scotland golf destination",
      summary: GLENEAGLES.statement,
      agendaCandidateId: GLENEAGLES.agendaCandidateId,
      researchBriefId: GLENEAGLES.researchBriefId,
      evidenceRefs: [
        {
          evidenceId: "ev_gleneagles_article",
          sourceId: "src_gleneagles_press",
          sourceType: "news",
          sourceName: "Travel press",
          isOfficial: false,
          evidenceType: "article",
          url: GLENEAGLES.articleUrl,
          reference: null,
          excerpt: GLENEAGLES.statement,
          publishedAt: "2026-09-01T00:00:00.000Z",
          observedAt: "2026-09-02T00:00:00.000Z",
          credibilityHint: 0.72,
        },
      ],
      idempotencyKey: `gleneagles-sim:${businessDateKst}`,
      now: new Date("2026-09-04T00:00:00.000Z"),
    },
    { store: createInMemoryContentAssignmentStore(), now: new Date("2026-09-04T00:00:00.000Z") },
  );

  return {
    contract: "completed-marketing-candidate-v1",
    candidateId: `cmc_daily_marketing_plan_${businessDateKst.replace(/-/g, "_")}`,
    runId: `run_${businessDateKst}`,
    logicalRunKey: `daily-marketing-plan:${businessDateKst}`,
    businessDateKst,
    createdAt: `${businessDateKst}T00:05:00.000Z`,
    updatedAt: `${businessDateKst}T00:05:00.000Z`,
    selectedAgenda: handoff.selectedAgenda,
    contentAssignment: handoff.contentAssignment,
    contentPlan: handoff.contentPlanScaffold,
    draft: {
      title: "Gleneagles",
      body: GLENEAGLES.statement,
      channel: "threads",
      agenda: handoff.selectedAgenda.title,
      sourceReferences: ["evidence:ev_gleneagles_article"],
    },
    governanceDecision: null,
    status: "ready_for_human_review",
    revisionHistory: [],
    provenance: {
      routineId: "daily-marketing-plan",
      correlationId: `corr_${businessDateKst}`,
      researchStatus: "ok",
      governanceReviewId: null,
    },
    observability: {
      runId: `run_${businessDateKst}`,
      logicalRunKey: `daily-marketing-plan:${businessDateKst}`,
      businessDateKst,
      correlationId: `corr_${businessDateKst}`,
      researchStatus: "ok",
      candidateCount: 1,
      selectedAgendaId: handoff.selectedAgenda.id,
      assignmentId: handoff.contentAssignment.assignmentId,
      governanceReviewId: null,
      revisionCount: 0,
      governanceDecision: null,
      finalCandidateId: null,
      finalStatus: null,
      startedAt: `${businessDateKst}T00:00:00.000Z`,
      completedAt: `${businessDateKst}T00:05:00.000Z`,
      failureReason: null,
    },
  };
}

function gleneaglesResearchContext(): MarketingResearchContext {
  return {
    contract: MARKETING_RESEARCH_CONTEXT_CONTRACT,
    status: "ok",
    generatedAt: "2026-09-05T00:00:00.000Z",
    window: {
      lookbackHours: 72,
      since: "2026-09-02T00:00:00.000Z",
      until: "2026-09-05T00:00:00.000Z",
    },
    agendaCandidates: [
      {
        agendaCandidateId: GLENEAGLES.agendaCandidateId,
        researchBriefId: GLENEAGLES.researchBriefId,
        title: "Gleneagles Scotland golf destination",
        summary: GLENEAGLES.statement,
        destinations: ["Scotland"],
        topics: ["golf", "travel"],
        entities: ["Gleneagles"],
        signalTypes: ["news"],
        publishedAt: "2026-09-01T00:00:00.000Z",
        observedAt: "2026-09-04T00:00:00.000Z",
        freshnessScore: 0.8,
        credibilityScore: 0.72,
        travelRelevanceScore: 0.9,
        publicInterestScore: 0.7,
        commercialRelevanceScore: 0.3,
        seasonalityScore: 0.6,
        corroborationScore: 0.5,
        noveltyScore: 0.4,
        totalResearchScore: 0.7,
        researchScoreComponents: null,
        scoreReasons: ["travel interest"],
        riskFlags: [],
        matchedProductIds: [],
        evidence: [
          {
            evidenceId: "ev_gleneagles_article",
            sourceId: "src_gleneagles_press",
            sourceType: "news",
            sourceName: "Travel press",
            isOfficial: false,
            evidenceType: "article",
            url: GLENEAGLES.articleUrl,
            reference: null,
            excerpt: GLENEAGLES.statement,
            publishedAt: "2026-09-01T00:00:00.000Z",
            observedAt: "2026-09-04T00:00:00.000Z",
          },
        ],
        candidateStatus: "eligible",
      },
    ],
    briefs: [
      {
        researchBriefId: GLENEAGLES.researchBriefId,
        title: "Gleneagles Scotland golf destination",
        summary: GLENEAGLES.statement,
        destinations: ["Scotland"],
        topics: ["golf", "travel"],
        entities: ["Gleneagles"],
        signalTypes: ["news"],
        publishedAt: "2026-09-01T00:00:00.000Z",
        observedAt: "2026-09-04T00:00:00.000Z",
        freshnessScore: 0.8,
        credibilityScore: 0.72,
        travelRelevanceScore: 0.9,
        publicInterestScore: 0.7,
        corroborationScore: 0.5,
        commercialRelevance: { level: "low", matchedProductIds: [] },
        evidence: [
          {
            evidenceId: "ev_gleneagles_article",
            sourceId: "src_gleneagles_press",
            sourceType: "news",
            sourceName: "Travel press",
            isOfficial: false,
            evidenceType: "article",
            url: GLENEAGLES.articleUrl,
            reference: null,
            excerpt: GLENEAGLES.statement,
            publishedAt: "2026-09-01T00:00:00.000Z",
            observedAt: "2026-09-04T00:00:00.000Z",
          },
        ],
        risks: [],
        openQuestions: [],
        generatedAt: "2026-09-04T00:00:00.000Z",
        validUntil: null,
      },
    ],
    sourceSummary: {
      officialSourceCount: 0,
      newsSourceCount: 1,
      independentSourceFamilies: 1,
      evidenceCount: 1,
    },
    degradedState: null,
    observability: {
      requestedAt: "2026-09-05T00:00:00.000Z",
      candidateCount: 1,
      briefCount: 1,
      topScore: 0.7,
      degraded: false,
      staleExcludedCount: 0,
      duplicateExcludedCount: 0,
    },
    notes: [],
  };
}

describe("READ-ONLY Gleneagles exclusion simulation", () => {
  it("excludes exact Gleneagles research identity given 09-02..09-04 history", () => {
    const history = [
      gleneaglesCandidate("2026-09-02"), // rejected in prod — still counts
      gleneaglesCandidate("2026-09-03"), // pending
      gleneaglesCandidate("2026-09-04"), // pending
    ];
    const today = "2026-09-05";
    const cooled = collectRecentResearchIdentities(history, today, 7);
    expect(cooled.agendaCandidateIds.has(GLENEAGLES.agendaCandidateId)).toBe(true);
    expect(cooled.researchBriefIds.has(GLENEAGLES.researchBriefId)).toBe(true);

    const applied = applyResearchIdentityCooldown(gleneaglesResearchContext(), cooled);
    expect(applied.excludedAgendaCandidateIds).toContain(GLENEAGLES.agendaCandidateId);
    expect(applied.context.agendaCandidates).toHaveLength(0);
    expect(applied.context.briefs).toHaveLength(0);
  });
});
