import { describe, expect, it } from "vitest";

import {
  MARKETING_PRODUCTION_REQUEST_CONTRACT,
  type MarketingProductionRequest,
} from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import { createInMemoryMarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import {
  PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_POINT_CANDIDATE_SET_CONTRACT,
  STORY_POINT_GATE_RESULT_CONTRACT,
  type DurableStoryPointCandidateSet,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { ensureStoryPointCandidateSet } from "@/lib/marketing/storyPoint/ensureStoryPointCandidateSet";
import { createStoryPointHash, createStoryPointInputRevision } from "@/lib/marketing/storyPoint/hash";
import {
  applyHumanSelectionToCandidateSet,
  buildHumanStorySelection,
  PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY,
  selectionIsActive,
} from "@/lib/marketing/storyPoint/humanStorySelection";
import { readStoryPointCandidateSetFromProductionRequest } from "@/lib/marketing/storyPoint/persistence";

function extPoint(id: string): StoryContentPoint {
  return {
    contract: STORY_CONTENT_POINT_CONTRACT,
    pointId: id,
    storyQuestion: "랑선은 누구에게 맞을까?",
    storyClaim: null,
    whyInteresting: "리조트 베트남과 다른 북부 전통마을",
    audienceTension: "익숙한 휴양 vs 문화 탐방",
    curiosityGap: "이런 베트남도 있었나",
    readerPayoff: "대안 목적지를 상상한다",
    mechanisms: ["curiosity_gap"],
    researchNeeded: ["접근성"],
    researchQuestions: ["페리/버스 일정은?"],
    genericRisk: "단정 금지",
    genericRiskMitigation: null,
    channelPotential: {
      conversation: "high",
      visualExplainability: "high",
      searchDepth: "medium",
      shortformHookability: "medium",
    },
    nonGoals: [],
    agendaFitNotes: `archetype:who_is_it_for | source:external_editorial_director`,
  };
}

function durableExternalSet(points: StoryContentPoint[]): DurableStoryPointCandidateSet {
  const gates = points.map((p, i) => ({
    contract: STORY_POINT_GATE_RESULT_CONTRACT,
    pointId: p.pointId,
    verdict: "pass" as const,
    hardFailReasons: [],
    softDemerits: [],
    scores: {
      interestingness: 0.8,
      specificity: 0.7,
      curiosityStrength: 0.7,
      readerPayoffStrength: 0.7,
      researchability: 0.8,
      genericRisk: 0.2,
      agendaFit: 0.8,
      noveltyAgainstRecentContent: 0.7,
      composite: 0.75 - i * 0.01,
    },
  }));
  return {
    contract: STORY_POINT_CANDIDATE_SET_CONTRACT,
    minerVersion: "external-v1",
    agendaId: "agenda_1",
    assignmentId: "assign_1",
    inputRevision: "old_revision_external",
    logicalIdentity: "agenda_1:assign_1:old_revision_external",
    createdAt: "2026-09-18T00:00:00.000Z",
    attempts: 1,
    llmCallCount: 0,
    outcome: "pass",
    skipReason: null,
    candidates: points,
    gateResults: gates,
    selectedPointIds: points.map((p) => p.pointId),
    primaryStoryPointId: points[0]?.pointId ?? null,
    alternateStoryPointIds: points.slice(1).map((p) => p.pointId),
    primaryStoryPointHash: points[0] ? createStoryPointHash(points[0]) : null,
    diagnostics: {
      candidateCount: points.length,
      passCount: points.length,
      diversityRejectedCount: 0,
      identityRejectedCount: 0,
      mechanisms: ["curiosity_gap"],
      selectedPrimaryTitle: points[0]?.storyQuestion ?? null,
      attemptSummaries: [],
    },
  };
}

function baseRequest(set: DurableStoryPointCandidateSet): MarketingProductionRequest {
  return {
    contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
    requestId: "mpr_test",
    logicalRunKey: "lrk_test",
    businessDateKst: "2026-09-18",
    slateItemId: "si_1",
    slateId: "slate_1",
    correlationId: "corr",
    status: "QUEUED",
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    claimedAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    attemptCount: 0,
    claimToken: null,
    lastError: null,
    errorMessage: null,
    workerId: null,
    completedCandidateId: null,
    selection: { title: "heritage" },
    metadata: {
      [PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY]: set,
    },
  } as MarketingProductionRequest;
}

describe("human story resume after external import", () => {
  it("prefers Full candidate set when richer than compact metadata", () => {
    const points = [extPoint("sp_ext_a"), extPoint("sp_ext_b")];
    const full = durableExternalSet(points);
    const compact = durableExternalSet([points[0]!]);
    const request = {
      ...baseRequest(compact),
      metadata: {
        [PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY]: compact,
        storyPointCandidateSetFull: full,
      },
    } as MarketingProductionRequest;
    const read = readStoryPointCandidateSetFromProductionRequest(request);
    expect(read?.candidates).toHaveLength(2);
  });

  it("reuses durable external set even when handoff inputRevision drifted", async () => {
    const points = [extPoint("sp_ext_resume_1"), extPoint("sp_ext_resume_2")];
    const set = durableExternalSet(points);
    const repo = createInMemoryMarketingProductionRequestRepository();
    await repo.enqueue(baseRequest(set));

    const handoff = {
      selectedAgenda: {
        id: "agenda_1",
        title: "heritage DIFFERENT TITLE",
        summary: "changed summary causes new revision",
        destinations: ["vietnam"],
        topics: ["heritage"],
        commercialIntent: "awareness",
        rationale: [],
        evidenceRefs: [],
      },
      contentAssignment: {
        assignmentId: "assign_1",
        objective: "different objective",
        topic: "heritage",
        commercialIntent: "awareness",
        evidenceRefs: [],
        facts: [],
      },
    } as any;

    const driftedRevision = createStoryPointInputRevision({
      agendaId: "agenda_1",
      assignmentId: "assign_1",
      agendaTitle: handoff.selectedAgenda.title,
      agendaSummary: handoff.selectedAgenda.summary,
      assignmentObjective: handoff.contentAssignment.objective,
      commercialIntent: "awareness",
      evidenceSnippet: "",
    });
    expect(driftedRevision).not.toBe(set.inputRevision);

    let minerCalled = 0;
    const result = await ensureStoryPointCandidateSet({
      handoff,
      logicalRunKey: "lrk_test",
      productionRequestRepo: repo,
      invoke: async () => {
        minerCalled += 1;
        return JSON.stringify({ candidates: [] });
      },
    });

    expect(minerCalled).toBe(0);
    expect(result.reused).toBe(true);
    expect(result.candidateSet.candidates.some((c) => c.pointId.startsWith("sp_ext_"))).toBe(true);

    const human = buildHumanStorySelection({ point: points[0]!, candidateSet: set });
    expect(selectionIsActive(human)).toBe(true);
    const applied = applyHumanSelectionToCandidateSet({
      candidateSet: result.candidateSet,
      selection: human,
    });
    expect(applied?.primaryStoryPointId).toBe("sp_ext_resume_1");

    await repo.update({
      ...(await repo.findByLogicalKey("lrk_test"))!,
      metadata: {
        ...(await repo.findByLogicalKey("lrk_test"))!.metadata,
        [PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY]: human,
      },
    });
  });
});
