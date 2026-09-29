/**
 * ED-LIVE — Human Story Selection + five-channel restoration regressions.
 */
import { describe, expect, it } from "vitest";

import {
  MARKETING_PRODUCTION_REQUEST_CONTRACT,
  type MarketingProductionRequest,
} from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import {
  AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
  type AudienceContentResearchBrief,
} from "@/lib/marketing/audienceResearch/contracts";
import { parseAudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/validate";
import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import { agendaSlateSelectStorySchema } from "@/lib/marketing/cron/daily/agendaSlate/validation";
import { createInMemoryMarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import {
  PUBLISHABLE_CHANNELS,
} from "@/lib/marketing/publishable/contracts";
import { resolveTargetPublishableChannels } from "@/lib/marketing/publishable/selectTargetChannels";
import {
  STORY_CONTENT_POINT_CONTRACT,
  STORY_POINT_CANDIDATE_SET_CONTRACT,
  STORY_POINT_GATE_RESULT_CONTRACT,
  type DurableStoryPointCandidateSet,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";
import {
  applyHumanResearchOverrideToBrief,
  applyHumanSelectionToCandidateSet,
  buildHumanStorySelection,
  listPassStoryCandidates,
  markStoryResearchRejected,
  PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
  PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY,
  PRODUCTION_REQUEST_STORY_RESEARCH_OVERRIDE_KEY,
  readHumanStorySelection,
  selectionIsActive,
  selectionOverridesResearch,
} from "@/lib/marketing/storyPoint/humanStorySelection";
import { PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY } from "@/lib/marketing/storyPoint/contracts";

function ninhStory(n: number): StoryContentPoint {
  return {
    contract: STORY_CONTENT_POINT_CONTRACT,
    pointId: `sp_ninh_${n}`,
    storyQuestion: `닌빈이 스마트폰 피로를 푸는 숨은 성소가 될 수 있을까? (#${n})`,
    storyClaim: `닌빈은 군중/스크린 피로를 푸는 대안 목적지로 인식되고 있다 (#${n})`,
    whyInteresting: "도시 피로 → 자연 회복 내러티브가 여행 의사결정에 자주 등장",
    audienceTension: "인기 휴양지 피로 vs 조용한 회복 욕구",
    curiosityGap: "왜 하필 닌빈인가에 대한 증거 공백",
    readerPayoff: "닌빈을 '회복 목적'으로 볼지 판단 기준",
    mechanisms: ["curiosity_gap", "decision_relief"],
    researchNeeded: ["닌빈 wellness 수요 신호", "군중 회피 목적지 비교"],
    researchQuestions: [
      "닌빈이 smartphone fatigue 대안으로 실제로 언급되는가?",
      "한국 여행자 후기에서 회복/고요함이 반복되는가?",
    ],
    genericRisk: "인과 비약(피로→닌빈 선택) 위험",
    genericRiskMitigation: "증거 경계로 주장 축소",
    channelPotential: {
      conversation: "high",
      visualExplainability: "high",
      searchDepth: "medium",
      shortformHookability: "high",
    },
    nonGoals: ["베트남 전역 가이드"],
    agendaFitNotes: "Vietnam / Ninh Binh wellness",
  };
}

function passGate(pointId: string, rank: number) {
  return {
    contract: STORY_POINT_GATE_RESULT_CONTRACT,
    pointId,
    verdict: "pass" as const,
    hardFailReasons: [],
    softDemerits: [],
    scores: {
      interestingness: 0.9,
      specificity: 0.9,
      curiosityStrength: 0.8,
      readerPayoffStrength: 0.8,
      researchability: 0.7,
      genericRisk: 0.2,
      agendaFit: 0.9,
      noveltyAgainstRecentContent: 0.7,
      composite: 0.9 - rank * 0.05,
    },
  };
}

function candidateSet(points: StoryContentPoint[]): DurableStoryPointCandidateSet {
  const primary = points[0]!;
  return {
    contract: STORY_POINT_CANDIDATE_SET_CONTRACT,
    minerVersion: "test-miner",
    agendaId: "ag_ninh",
    assignmentId: "asg_ninh",
    inputRevision: "rev_ninh_v1",
    logicalIdentity: "id_ninh_v1",
    createdAt: new Date().toISOString(),
    attempts: 1,
    llmCallCount: 1,
    outcome: "pass",
    skipReason: null,
    candidates: points,
    gateResults: points.map((p, i) => passGate(p.pointId, i + 1)),
    selectedPointIds: points.map((p) => p.pointId),
    primaryStoryPointId: primary.pointId,
    alternateStoryPointIds: points.slice(1).map((p) => p.pointId),
    primaryStoryPointHash: createStoryPointHash(primary),
    diagnostics: {
      candidateCount: points.length,
      passCount: points.length,
      diversityRejectedCount: 0,
      identityRejectedCount: 0,
      mechanisms: ["curiosity_gap"],
      selectedPrimaryTitle: primary.storyQuestion,
      attemptSummaries: [],
    },
  };
}

function baseRequest(
  overrides: Partial<MarketingProductionRequest> = {},
): MarketingProductionRequest {
  const set = candidateSet([ninhStory(1), ninhStory(2), ninhStory(3), ninhStory(4), ninhStory(5)]);
  return {
    contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
    requestId: "mpr_test_story",
    logicalRunKey: "daily-marketing-production:2026-09-14:ninh",
    slateId: "das_test",
    slateItemId: "asc_aaaaaaaaaaaaaaaaaaaaaaaa",
    businessDateKst: "2026-09-14",
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    claimedAt: null,
    startedAt: null,
    completedAt: new Date().toISOString(),
    failedAt: null,
    attemptCount: 1,
    claimToken: null,
    lastError: null,
    workerId: null,
    selection: {
      title: "Vietnam Ninh Binh sanctuary",
      summary: "wellness hidden sanctuary",
      agendaCandidateId: null,
      researchBriefId: null,
      rationale: [],
      recommendedChannel: null,
      recommendedFormats: [],
    },
    errorMessage: null,
    completedCandidateId: null,
    metadata: {
      productionOutcome: PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
      [PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY]: set,
    },
    ...overrides,
  };
}

describe("ED-LIVE human story selection", () => {
  it("lists PASS candidates and applies authoritative human selection", () => {
    const set = candidateSet([ninhStory(1), ninhStory(2), ninhStory(3)]);
    const pass = listPassStoryCandidates(set);
    expect(pass.length).toBe(3);
    const selection = buildHumanStorySelection({ point: pass[1]!.point, candidateSet: set });
    expect(selection.selectedBy).toBe("human");
    expect(selection.selectedStoryPointId).toBe("sp_ninh_2");
    const applied = applyHumanSelectionToCandidateSet({ candidateSet: set, selection });
    expect(applied?.primaryStoryPointId).toBe("sp_ninh_2");
    expect(applied?.alternateStoryPointIds).toEqual([]);
    expect(applied?.primaryStoryPointHash).toBe(createStoryPointHash(pass[1]!.point));
  });

  it("keeps human selection when candidateSet inputRevision drifts but PASS point remains", () => {
    const set = candidateSet([ninhStory(1), ninhStory(2)]);
    const selection = buildHumanStorySelection({ point: set.candidates[1]!, candidateSet: set });
    const reminted = { ...set, inputRevision: "rev_ninh_v2" };
    const applied = applyHumanSelectionToCandidateSet({ candidateSet: reminted, selection });
    expect(applied?.primaryStoryPointId).toBe("sp_ninh_2");
    expect(selectionIsActive(selection)).toBe(true);
  });

  it("rejects human selection when the selected PASS point is missing from the set", () => {
    const set = candidateSet([ninhStory(1), ninhStory(2)]);
    const selection = buildHumanStorySelection({ point: set.candidates[1]!, candidateSet: set });
    const withoutSelected = {
      ...set,
      candidates: [set.candidates[0]!],
      gateResults: set.gateResults.filter((g) => g.pointId === "sp_ninh_1"),
      selectedPointIds: ["sp_ninh_1"],
      primaryStoryPointId: "sp_ninh_1",
    };
    expect(
      applyHumanSelectionToCandidateSet({ candidateSet: withoutSelected, selection }),
    ).toBeNull();
  });

  it("research rejection clears selection and keeps remaining candidates selectable", () => {
    const set = candidateSet([ninhStory(1), ninhStory(2), ninhStory(3)]);
    const selection = buildHumanStorySelection({ point: set.candidates[0]!, candidateSet: set });
    const rejected = markStoryResearchRejected({
      selection,
      reason: "INSUFFICIENT_EVIDENCE",
    });
    expect(rejected.selectedStoryPointId).toBeNull();
    expect(rejected.researchRejectedStoryPointIds).toContain("sp_ninh_1");
    const next = buildHumanStorySelection({
      point: set.candidates[1]!,
      candidateSet: set,
      previous: rejected,
    });
    const applied = applyHumanSelectionToCandidateSet({ candidateSet: set, selection: next });
    expect(applied?.primaryStoryPointId).toBe("sp_ninh_2");
    expect(
      applyHumanSelectionToCandidateSet({
        candidateSet: set,
        selection: { ...next, selectedStoryPointId: "sp_ninh_1", selectedStoryPointHash: createStoryPointHash(set.candidates[0]!) },
      }),
    ).toBeNull();
  });

  it("human override lets a research-rejected Story become the authoritative primary again", () => {
    const set = candidateSet([ninhStory(1), ninhStory(2), ninhStory(3)]);
    const selection = buildHumanStorySelection({ point: set.candidates[0]!, candidateSet: set });
    const rejected = markStoryResearchRejected({ selection, reason: "story_point_insufficient_evidence" });

    const overridden = buildHumanStorySelection({
      point: set.candidates[0]!,
      candidateSet: set,
      previous: rejected,
      overrideResearchRejection: true,
    });
    expect(overridden.researchRejectedStoryPointIds).not.toContain("sp_ninh_1");
    expect(overridden.researchOverrideStoryPointIds).toEqual(["sp_ninh_1"]);
    expect(selectionOverridesResearch(overridden, "sp_ninh_1")).toBe(true);
    expect(selectionOverridesResearch(overridden, "sp_ninh_2")).toBe(false);
    expect(applyHumanSelectionToCandidateSet({ candidateSet: set, selection: overridden })?.primaryStoryPointId).toBe(
      "sp_ninh_1",
    );
  });

  it("without override a rejected Story stays blocked and the override list survives later rejects", () => {
    const set = candidateSet([ninhStory(1), ninhStory(2)]);
    const first = buildHumanStorySelection({ point: set.candidates[0]!, candidateSet: set });
    const rejected = markStoryResearchRejected({ selection: first, reason: "REFUTED" });
    const again = buildHumanStorySelection({ point: set.candidates[0]!, candidateSet: set, previous: rejected });
    expect(applyHumanSelectionToCandidateSet({ candidateSet: set, selection: again })).toBeNull();
    expect(selectionOverridesResearch(again, "sp_ninh_1")).toBe(false);

    const overridden = buildHumanStorySelection({
      point: set.candidates[0]!,
      candidateSet: set,
      previous: rejected,
      overrideResearchRejection: true,
    });
    const next = buildHumanStorySelection({ point: set.candidates[1]!, candidateSet: set, previous: overridden });
    const nextRejected = markStoryResearchRejected({ selection: next, reason: "REFUTED" });
    expect(nextRejected.researchOverrideStoryPointIds).toEqual(["sp_ninh_1"]);
    expect(nextRejected.researchRejectedStoryPointIds).toEqual(["sp_ninh_2"]);
  });

  it("reads legacy selections without researchOverrideStoryPointIds as no override", () => {
    const request = baseRequest({
      metadata: {
        productionOutcome: PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
        [PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY]: {
          selectedStoryPointId: null,
          selectedStoryPointHash: null,
          selectedAt: null,
          selectedBy: "human",
          candidateSetInputRevision: "rev_ninh_v1",
          researchRejectedStoryPointIds: ["sp_ninh_1"],
          lastResearchRejectReason: "story_point_insufficient_evidence",
        },
      },
    });
    const read = readHumanStorySelection(request);
    expect(read?.researchOverrideStoryPointIds).toEqual([]);
    expect(read?.researchRejectedStoryPointIds).toEqual(["sp_ninh_1"]);
  });

  it("requeues awaiting_story_selection after human pick without remine metadata wipe", async () => {
    const repo = createInMemoryMarketingProductionRequestRepository();
    const initial = baseRequest();
    await repo.enqueue(initial);
    const set = initial.metadata[PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY] as DurableStoryPointCandidateSet;
    const selection = buildHumanStorySelection({ point: set.candidates[1]!, candidateSet: set });
    await repo.update({
      ...initial,
      metadata: {
        ...initial.metadata,
        [PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY]: selection,
      },
    });
    const requeued = await repo.requeueAwaitingStorySelection({
      logicalRunKey: initial.logicalRunKey,
    });
    expect(requeued.status).toBe("QUEUED");
    expect(requeued.metadata.productionOutcome).toBe("story_selection_resumed");
    expect(readHumanStorySelection(requeued)?.selectedStoryPointId).toBe("sp_ninh_2");
    expect(requeued.metadata[PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY]).toBeTruthy();
  });
});

describe("pipeline research override decision", () => {
  const set = candidateSet([ninhStory(1), ninhStory(2)]);
  const skipBrief = {
    contract: AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
    id: "acrb_ninh_1",
    logicalIdentity: "acrb_ninh_logical",
    researchVerdict: "SKIP",
    storySupportVerdict: "INSUFFICIENT_EVIDENCE",
    storyPointRef: {
      storyPointId: "sp_ninh_1",
      storyPointHash: createStoryPointHash(set.candidates[0]!),
      researchContractVersion: "test",
    },
  } as unknown as AudienceContentResearchBrief;
  const now = new Date("2026-09-14T03:00:00.000Z");
  const rejected = markStoryResearchRejected({
    selection: buildHumanStorySelection({ point: set.candidates[0]!, candidateSet: set }),
    reason: "story_point_insufficient_evidence",
  });
  const overridden = buildHumanStorySelection({
    point: set.candidates[0]!,
    candidateSet: set,
    previous: rejected,
    overrideResearchRejection: true,
  });

  it("overridden Story proceeds with caution and keeps the real verdict", () => {
    const brief = applyHumanResearchOverrideToBrief({
      brief: skipBrief,
      storyResearchBlocked: true,
      selectionActive: true,
      selection: overridden,
      fallbackStoryPointId: null,
      now,
    });
    expect(brief?.researchVerdict).toBe("PROCEED_WITH_CAUTION");
    expect(brief?.storySupportVerdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(brief?.storyResearchHumanOverride).toEqual({
      storyPointId: "sp_ninh_1",
      originalVerdict: "INSUFFICIENT_EVIDENCE",
      originalResearchVerdict: "SKIP",
      overriddenAt: now.toISOString(),
    });
  });

  it("stays blocked without an override for this Story, without an active selection, or when not blocked", () => {
    const plain = buildHumanStorySelection({ point: set.candidates[0]!, candidateSet: set });
    const base = {
      brief: skipBrief,
      storyResearchBlocked: true,
      selectionActive: true,
      selection: overridden,
      fallbackStoryPointId: null,
      now,
    };
    expect(applyHumanResearchOverrideToBrief({ ...base, selection: plain })).toBeNull();
    expect(applyHumanResearchOverrideToBrief({ ...base, selectionActive: false })).toBeNull();
    expect(applyHumanResearchOverrideToBrief({ ...base, storyResearchBlocked: false })).toBeNull();
    expect(
      applyHumanResearchOverrideToBrief({
        ...base,
        brief: { ...skipBrief, storyPointRef: { ...skipBrief.storyPointRef!, storyPointId: "sp_ninh_2" } },
      }),
    ).toBeNull();
  });

  it("override marker survives the ACRB parser used for packages and request metadata", () => {
    const brief = applyHumanResearchOverrideToBrief({
      brief: skipBrief,
      storyResearchBlocked: true,
      selectionActive: true,
      selection: overridden,
      fallbackStoryPointId: null,
      now,
    });
    const parsed = parseAudienceContentResearchBrief(JSON.parse(JSON.stringify(brief)));
    expect(parsed?.storyResearchHumanOverride?.storyPointId).toBe("sp_ninh_1");
    expect(parsed?.storyResearchHumanOverride?.originalVerdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(parseAudienceContentResearchBrief(skipBrief)?.storyResearchHumanOverride).toBeNull();
  });

  it("pipeline routes the blocked branch through the override decision", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const pipeline = await fs.readFile(
      path.join(process.cwd(), "src/lib/marketing/cron/daily/runDailyMarketingProductionPipeline.ts"),
      "utf8",
    );
    expect(pipeline).toMatch(/applyHumanResearchOverrideToBrief/);
    expect(pipeline).toMatch(/!storyResearchHumanOverride &&/);
  });
});

describe("select-story research override (service)", () => {
  async function seedRejected() {
    const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
    const initial = baseRequest();
    const set = initial.metadata[PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY] as DurableStoryPointCandidateSet;
    const rejected = markStoryResearchRejected({
      selection: buildHumanStorySelection({ point: set.candidates[0]!, candidateSet: set }),
      reason: "story_point_insufficient_evidence",
    });
    await productionRequestRepo.enqueue({
      ...initial,
      metadata: {
        ...initial.metadata,
        [PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY]: rejected,
        lastStoryResearchRejectReason: rejected.lastResearchRejectReason,
      },
    });
    const service = await createAgendaSlateService({
      productionRequestRepo,
      now: new Date("2026-09-14T03:00:00.000Z"),
    });
    return { productionRequestRepo, service, logicalRunKey: initial.logicalRunKey };
  }

  it("still refuses a rejected Story without the override flag", async () => {
    const { service, logicalRunKey } = await seedRejected();
    await expect(
      service.selectStoryAndResumeProduction({ logicalRunKey, storyPointId: "sp_ninh_1" }),
    ).rejects.toMatchObject({ code: "STORY_RESEARCH_REJECTED" });
  });

  it("override requeues the rejected Story and records who overrode which verdict", async () => {
    const { service, logicalRunKey } = await seedRejected();
    const { request } = await service.selectStoryAndResumeProduction({
      logicalRunKey,
      storyPointId: "sp_ninh_1",
      overrideResearchRejection: true,
    });
    expect(request.status).toBe("QUEUED");
    const selection = readHumanStorySelection(request);
    expect(selection?.selectedStoryPointId).toBe("sp_ninh_1");
    expect(selection?.researchOverrideStoryPointIds).toEqual(["sp_ninh_1"]);
    expect(selection?.researchRejectedStoryPointIds).not.toContain("sp_ninh_1");
    expect(request.metadata[PRODUCTION_REQUEST_STORY_RESEARCH_OVERRIDE_KEY]).toMatchObject({
      storyPointId: "sp_ninh_1",
      previousRejectReason: "story_point_insufficient_evidence",
      overriddenBy: "human",
    });
  });

  it("override flag on a never-rejected Story is a normal selection", async () => {
    const { service, logicalRunKey } = await seedRejected();
    const { request } = await service.selectStoryAndResumeProduction({
      logicalRunKey,
      storyPointId: "sp_ninh_2",
      overrideResearchRejection: true,
    });
    expect(readHumanStorySelection(request)?.researchOverrideStoryPointIds).toEqual([]);
    expect(request.metadata[PRODUCTION_REQUEST_STORY_RESEARCH_OVERRIDE_KEY]).toBeUndefined();
  });

  it("select-story schema accepts the optional override flag", () => {
    const parsed = agendaSlateSelectStorySchema.safeParse({
      slateItemId: "asc_aaaaaaaaaaaaaaaaaaaaaaaa",
      storyPointId: "sp_ninh_1",
      overrideResearchRejection: true,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("ED-LIVE channel restoration", () => {
  it("standard configured production resolves all five publishable channels", () => {
    expect(resolveTargetPublishableChannels({})).toEqual([...PUBLISHABLE_CHANNELS]);
    expect(
      resolveTargetPublishableChannels({ contentPlanTargetChannels: ["threads", "shortform"] }),
    ).toEqual([...PUBLISHABLE_CHANNELS]);
  });

  it("fails if registry unexpectedly collapses to threads+shortform only", () => {
    const resolved = resolveTargetPublishableChannels({
      contentPlanTargetChannels: null,
    });
    const collapsed =
      resolved.length === 2 &&
      resolved.includes("threads") &&
      resolved.includes("shortform") &&
      !resolved.includes("naver_blog");
    expect(collapsed).toBe(false);
    expect(resolved).toContain("naver_blog");
    expect(resolved).toContain("naver_band");
    expect(resolved).toContain("kakao_channel");
  });

  it("explicit override may intentionally keep baseline-only", () => {
    expect(
      resolveTargetPublishableChannels({ explicit: ["threads", "shortform"] }),
    ).toEqual(["threads", "shortform"]);
  });
});

describe("ED-LIVE live path wiring (static)", () => {
  it("maps UI request-production to queue worker / production pipeline entrypoints", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.cwd();
    const requestRoute = await fs.readFile(
      path.join(root, "src/app/api/admin/marketing-review/agenda-slate/request-production/route.ts"),
      "utf8",
    );
    const selectRoute = await fs.readFile(
      path.join(root, "src/app/api/admin/marketing-review/agenda-slate/select-story/route.ts"),
      "utf8",
    );
    const queue = await fs.readFile(
      path.join(root, "src/lib/marketing/cron/daily/agendaSlate/processMarketingProductionQueue.ts"),
      "utf8",
    );
    const fromSelection = await fs.readFile(
      path.join(root, "src/lib/marketing/cron/daily/runDailyMarketingProductionFromSelection.ts"),
      "utf8",
    );
    const pipeline = await fs.readFile(
      path.join(root, "src/lib/marketing/cron/daily/runDailyMarketingProductionPipeline.ts"),
      "utf8",
    );
    expect(requestRoute).toMatch(/requestProductionForSelected/);
    expect(requestRoute).toMatch(/executedProduction:\s*false/);
    expect(selectRoute).toMatch(/selectStoryAndResumeProduction/);
    expect(queue).toMatch(/executeProduction/);
    expect(queue).toMatch(/awaiting_story_selection/);
    expect(fromSelection).toMatch(/runDailyMarketingProductionPipeline/);
    expect(pipeline).toMatch(/ensureStoryPointCandidateSet/);
    expect(pipeline).toMatch(/PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION/);
    expect(pipeline).toMatch(/marketing\.story_point/);
  });

  it("pipeline pauses before RA-1 when human selection missing", () => {
    const set = candidateSet([ninhStory(1), ninhStory(2)]);
    const noSelection = applyHumanSelectionToCandidateSet({
      candidateSet: set,
      selection: {
        selectedStoryPointId: null,
        selectedStoryPointHash: null,
        selectedAt: null,
        selectedBy: "human",
        candidateSetInputRevision: set.inputRevision,
        researchRejectedStoryPointIds: [],
        lastResearchRejectReason: null,
        researchOverrideStoryPointIds: [],
      },
    });
    expect(noSelection).toBeNull();
  });
});
