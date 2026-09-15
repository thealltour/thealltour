import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
  PRODUCTION_REQUEST_ACRB_METADATA_KEY,
} from "@/lib/marketing/audienceResearch/contracts";
import { buildDeterministicAcrb } from "@/lib/marketing/audienceResearch/deterministicSkeleton";
import { ensureAudienceContentResearch } from "@/lib/marketing/audienceResearch/ensureAudienceContentResearch";
import { gatherAcrbInputs } from "@/lib/marketing/audienceResearch/gatherInputs";
import { AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH } from "@/lib/marketing/audienceResearch/paths";
import { synthesizeAudienceContentResearch } from "@/lib/marketing/audienceResearch/synthesize";
import {
  assertAudienceContentResearchBrief,
  buildEvidenceFingerprint,
  parseAudienceContentResearchBrief,
  toAudienceContentResearchBriefRef,
} from "@/lib/marketing/audienceResearch/validate";
import { exportMarketingCandidatePackage } from "@/lib/marketing/assets/exportMarketingCandidatePackage";
import { prepareContentToGovernanceHandoff } from "@/lib/marketing/content/governance/prepareContentToGovernanceHandoff";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  MARKETING_PRODUCTION_REQUEST_CONTRACT,
  createInMemoryMarketingProductionRequestRepository,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { runDailyMarketingProductionFromSelection } from "@/lib/marketing/cron/daily/runDailyMarketingProductionFromSelection";
import type { ResearchBriefEditorialIntelligence } from "@/lib/marketing/research/types/editorialIntelligence";
import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";

function busanSelection() {
  return {
    title: "부산 출발 크루즈 추석 탑승 가이드 콘텐츠 관측",
    summary:
      "공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선과 가족 동반 체험을 소개하는 콘텐츠가 관측됨",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: ["부산"],
    topics: ["크루즈", "추석", "탑승"],
    entities: ["MSC 벨리시마"],
    researchBriefId: "rb_busan_cruise_test",
    agendaCandidateId: "ac_busan_cruise_test",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta AI Trend Discovery",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/DdEgr-UyM2S/",
        reference: "meta_ai:obs_859cff5669e827ef7a82d3a35bd9d242",
        excerpt:
          "공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선과 가족 동반 체험을 소개하는 콘텐츠가 관측됨",
        publishedAt: null,
        observedAt: "2026-09-09T15:10:00.000Z",
        credibilityHint: 0.35,
      },
    ],
  };
}

function editorial(): ResearchBriefEditorialIntelligence {
  return {
    hookSignals: ["첫 크루즈 탑승 전 동선", "가족과 함께"],
    formatSignals: ["short_video", "checklist"],
    audiencePainPoints: ["공항 이동 부담", "탑승 절차 막막함"],
    audienceQuestions: ["부산항 탑승 동선은?", "아이와 함께 타도 될까?"],
    personaHints: ["부산·경남 거주 다세대 가족", "첫 크루즈 초보"],
    contentAngles: ["가족 해상 휴가", "부산 출발 접근성"],
  };
}

function fullBrief(): ResearchBrief {
  return {
    id: "rb_busan_cruise_test",
    title: "부산 출발 크루즈",
    summary: "관측 요약",
    signalIds: [],
    claims: [],
    evidence: [],
    topics: ["크루즈"],
    destinations: ["부산"],
    entities: [],
    freshness: { publishedAt: null, observedAt: "2026-09-09T15:10:00.000Z", freshnessScore: 0.7 },
    credibility: { score: 0.35, reasons: ["social"] },
    travelRelevance: { score: 0.8, reasons: [] },
    publicInterest: 0.6,
    risks: [],
    openQuestions: [],
    generatedAt: "2026-09-09T15:10:00.000Z",
    status: "active",
    editorialIntelligence: editorial(),
  } as ResearchBrief;
}

function emptyGathered(handoff: ReturnType<typeof prepareManagerToContentHandoff>) {
  return {
    selectedAgenda: handoff.selectedAgenda,
    assignment: handoff.contentAssignment,
    evidencePack: handoff.evidencePack,
    compactBrief: null,
    compactCandidate: null,
    fullResearchBrief: fullBrief(),
    editorial: editorial(),
    historicalMatches: [] as never[],
    semanticAvailable: false,
    nearDuplicate: false,
    cooledIdentity: false,
    externalResearch: null,
  };
}

function makeMpr(logicalRunKey: string): MarketingProductionRequest {
  const iso = "2026-09-12T12:00:00.000Z";
  return {
    contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
    requestId: `mpr_${logicalRunKey.slice(-12)}`,
    logicalRunKey,
    slateId: "slate_test",
    slateItemId: "item_1",
    businessDateKst: "2026-09-12",
    status: "QUEUED",
    createdAt: iso,
    updatedAt: iso,
    claimedAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    attemptCount: 0,
    claimToken: null,
    lastError: null,
    workerId: null,
    selection: {
      title: busanSelection().title,
      summary: busanSelection().summary,
      agendaCandidateId: "ac_busan_cruise_test",
      researchBriefId: "rb_busan_cruise_test",
      rationale: [],
      recommendedChannel: "threads",
      recommendedFormats: [],
    },
    errorMessage: null,
    completedCandidateId: null,
    metadata: { productId: "prod_test" },
  };
}

describe("RA-1B AudienceContentResearchBrief", () => {
  it("parses contract and preserves finding types", () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const brief = buildDeterministicAcrb({ gathered: emptyGathered(handoff) });
    expect(brief.contract).toBe(AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT);
    expect(brief.researchFindings.every((f) => Boolean(f.type))).toBe(true);
    expect(brief.audience.primary[0]?.text).not.toMatch(/여행을 즐기고 싶은 사람/);
    expect(brief.contentAngles.length).toBeGreaterThanOrEqual(3);
    expect(brief.contentAngles.length).toBeLessThanOrEqual(5);
    expect(brief.researchVerdict).toBe("PROCEED_WITH_CAUTION");
    expect(brief.sourceCoverage.externalWebSearch).toBe(false);
    expect(brief.limitations.some((l) => /공식|웹검색|verified/i.test(l))).toBe(true);
    const roundTrip = assertAudienceContentResearchBrief(JSON.parse(JSON.stringify(brief)));
    expect(roundTrip.recommendedAngleId).toBeTruthy();
    expect(toAudienceContentResearchBriefRef(roundTrip).sha256).toHaveLength(64);
  });

  it("converts Meta editorial seeds without treating them as final angles", () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const brief = buildDeterministicAcrb({ gathered: emptyGathered(handoff) });
    expect(brief.sourceCoverage.metaEditorial).toBe(true);
    expect(brief.audience.anxieties.some((a) => a.text.includes("탑승"))).toBe(true);
    expect(brief.searchIntent.questions.length).toBeGreaterThan(0);
    expect(brief.contentAngles.every((a) => !/^시드\s*재평가\s*:/.test(a.angle))).toBe(true);
    expect(brief.contentAngles.some((a) => /탑승 직전|부산항|가족/.test(a.angle))).toBe(true);
    expect(brief.contentAngles.every((a) => a.hook.length > 10)).toBe(true);
    expect(brief.contentAngles.every((a) => !/알아보세요/.test(a.hook))).toBe(true);
  });

  it("degrades when semantic unavailable", () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const brief = buildDeterministicAcrb({
      gathered: {
        ...emptyGathered(handoff),
        fullResearchBrief: null,
        editorial: null,
        semanticAvailable: false,
      },
    });
    expect(brief.researchStatus).toBe("partial");
    expect(brief.limitations.some((l) => /시맨틱/i.test(l))).toBe(true);
  });

  it("SKIP for near-duplicate with no useful gap", () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const brief = buildDeterministicAcrb({
      gathered: {
        ...emptyGathered(handoff),
        fullResearchBrief: null,
        editorial: null,
        historicalMatches: [
          {
            kind: "candidate",
            id: "cmc_old",
            title: "부산 출발 크루즈 추석 탑승 가이드 콘텐츠 관측",
            similarityHint: 0.95,
            reason: "lexical_title_overlap",
          },
        ],
        semanticAvailable: true,
        nearDuplicate: true,
        cooledIdentity: true,
      },
    });
    expect(brief.researchVerdict).toBe("SKIP");
    expect(brief.verdictReasons).toContain("near_duplicate_recent");
  });

  it("malformed LLM falls back to deterministic partial", async () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const gathered = await gatherAcrbInputs({
      handoff,
      deps: {
        loadFullResearchBrief: async () => fullBrief(),
        listRecentCandidateTitles: async () => [],
        semanticAvailable: false,
      },
    });
    const brief = await synthesizeAudienceContentResearch({
      gathered,
      invoke: async () => "not-json{{{",
    });
    expect(brief.provenance.synthesisMode).toBe("deterministic_fallback");
    expect(brief.researchStatus).toBe("partial");
    expect(brief.researchVerdict).not.toBe("PROCEED");
  });

  it("persists ACRB before CS and reuses on retry", async () => {
    const handoff = prepareManagerToContentHandoff(
      { ...busanSelection(), idempotencyKey: "acrb-durability-1" },
      { store: createInMemoryContentAssignmentStore() },
    );
    const mprRepo = createInMemoryMarketingProductionRequestRepository();
    const logicalRunKey = "daily-marketing-production:2026-09-12:acrbdurability000001";
    await mprRepo.enqueue(makeMpr(logicalRunKey));

    const first = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: mprRepo,
      loadFullResearchBrief: async () => fullBrief(),
      listRecentCandidateTitles: async () => [],
    });
    expect(first.persisted).toBe(true);
    expect(first.reused).toBe(false);

    const stored = await mprRepo.findByLogicalKey(logicalRunKey);
    expect(stored?.metadata[PRODUCTION_REQUEST_ACRB_METADATA_KEY]).toBeTruthy();

    const second = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: mprRepo,
      invoke: async () => {
        throw new Error("should_not_invoke");
      },
    });
    expect(second.reused).toBe(true);
    expect(second.brief.id).toBe(first.brief.id);
  });

  it("SKIP short-circuits CS in production pipeline", async () => {
    const mprRepo = createInMemoryMarketingProductionRequestRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const assignmentStore = createInMemoryContentAssignmentStore();
    const logicalRunKey = "daily-marketing-production:2026-09-12:acrbskipfixture0000002";
    await mprRepo.enqueue(makeMpr(logicalRunKey));

    const handoff = prepareManagerToContentHandoff(
      {
        ...busanSelection(),
        // Production uses logicalRunKey as assignment idempotency key.
        idempotencyKey: logicalRunKey,
      },
      { store: assignmentStore },
    );
    const realSkip = buildDeterministicAcrb({
      gathered: {
        selectedAgenda: handoff.selectedAgenda,
        assignment: handoff.contentAssignment,
        evidencePack: handoff.evidencePack,
        compactBrief: null,
        compactCandidate: null,
        fullResearchBrief: null,
        editorial: null,
        historicalMatches: [
          {
            kind: "candidate",
            id: "cmc_prior_dup",
            title: busanSelection().title,
            similarityHint: 0.95,
            reason: "test_fixture",
          },
        ],
        semanticAvailable: true,
        nearDuplicate: true,
        cooledIdentity: true,
        externalResearch: null,
      },
    });
    expect(realSkip.researchVerdict).toBe("SKIP");

    const { persistDurableAcrb } = await import("@/lib/marketing/audienceResearch/persistence");
    await persistDurableAcrb({
      repo: mprRepo,
      logicalRunKey,
      brief: realSkip,
    });

    const requestDraft = vi.fn(async () => {
      throw new Error("CS should not run on SKIP");
    });
    const requestGovernance = vi.fn(async () => {
      throw new Error("GA should not run on SKIP");
    });

    // ED-1 Story Miner runs before ACRB; inject PASS StoryPoints so ACRB SKIP path is reachable.
    const invokeStoryMiner = async () =>
      JSON.stringify({
        candidates: Array.from({ length: 5 }, (_, i) => ({
          pointId: `sp_busan_skip_${i + 1}`,
          storyQuestion: `부산 출발 크루즈 첫 탑승에서 터미널 동선이 왜 막히는가? (${i + 1})`,
          storyClaim: null,
          whyInteresting:
            "첫 탑승 가족이 터미널 동선과 수하물 타이밍을 헷갈려 실제 대기 스트레스를 반복적으로 겪는다",
          audienceTension:
            "선사 안내만 보면 쉬워 보이지만 부산항 현장 동선은 처음 가는 부모님 동반에 부담이 된다",
          curiosityGap:
            "공식 안내의 '간단 탑승'과 실제 부산항 첫 탑승 대기/이동 경험이 어긋나는 지점이 무엇인지",
          readerPayoff:
            "첫 탑승 전에 어떤 동선·타이밍을 미리 확인해야 하는지 한 가지 판단 기준을 얻는다",
          mechanisms: ["curiosity_gap", "decision_relief"],
          researchNeeded: ["부산항 터미널 공식 동선", "첫 탑승 후기 패턴"],
          researchQuestions: [
            "부산항 크루즈 터미널 공식 동선 안내와 실 후기 대기가 실제로 어긋나는가?",
            "부모님 동반 첫 탑승 후기에서 수하물/이동 불편이 반복되는가?",
          ],
          genericRisk: "탑승 체크리스트 나열로 붕괴 가능",
          genericRiskMitigation: "동선 한 가지 판단 기준으로 고정",
          channelPotential: {
            conversation: "high",
            visualExplainability: "medium",
            searchDepth: "high",
            shortformHookability: "medium",
          },
          nonGoals: ["크루즈 종합 가이드", "준비 체크리스트 나열"],
        })),
      });

    const result = await runDailyMarketingProductionFromSelection(
      {
        productId: "prod_test",
        channel: "threads",
        businessDateKst: "2026-09-12",
        logicalRunKey,
        selection: {
          ...busanSelection(),
          idempotencyKey: logicalRunKey,
        },
      },
      {
        repo: runRepo,
        productionRequestRepo: mprRepo,
        contentAssignmentStore: assignmentStore,
        requestDraft,
        requestGovernance,
        invokeStoryMiner,
        getResearchContext: async () => ({
          contract: "marketing-research-context-v1",
          status: "ok",
          generatedAt: "2026-09-12T12:00:00.000Z",
          window: {
            lookbackHours: 168,
            since: "2026-09-05T00:00:00.000Z",
            until: "2026-09-12T12:00:00.000Z",
          },
          agendaCandidates: [
            {
              agendaCandidateId: "ac_busan_cruise_test",
              researchBriefId: "rb_busan_cruise_test",
              title: busanSelection().title,
              summary: busanSelection().summary,
              destinations: ["부산"],
              topics: ["크루즈"],
              entities: [],
              signalTypes: ["activity_trend"],
              publishedAt: null,
              observedAt: "2026-09-09T15:10:00.000Z",
              freshnessScore: 0.7,
              credibilityScore: 0.35,
              travelRelevanceScore: 0.8,
              publicInterestScore: 0.6,
              commercialRelevanceScore: 0.2,
              seasonalityScore: 0.5,
              corroborationScore: 0.2,
              noveltyScore: 0.4,
              koreanOutboundRelevanceScore: 0.7,
              totalResearchScore: 0.55,
              researchScoreComponents: null,
              scoreReasons: [],
              riskFlags: [],
              matchedProductIds: [],
              evidence: [],
              candidateStatus: "active",
            },
          ],
          briefs: [
            {
              researchBriefId: "rb_busan_cruise_test",
              title: "부산 출발 크루즈",
              summary: busanSelection().summary,
              destinations: ["부산"],
              topics: ["크루즈"],
              entities: [],
              signalTypes: ["activity_trend"],
              publishedAt: null,
              observedAt: "2026-09-09T15:10:00.000Z",
              freshnessScore: 0.7,
              credibilityScore: 0.35,
              travelRelevanceScore: 0.8,
              publicInterestScore: 0.6,
              corroborationScore: null,
              commercialRelevance: null,
              evidence: [],
              risks: [],
              openQuestions: [],
              generatedAt: "2026-09-09T15:10:00.000Z",
              validUntil: null,
            },
          ],
          sourceSummary: {
            officialSourceCount: 0,
            newsSourceCount: 0,
            independentSourceFamilies: 1,
            evidenceCount: 1,
          },
          degradedState: null,
          observability: {
            requestedAt: "2026-09-12T12:00:00.000Z",
            candidateCount: 1,
            briefCount: 1,
            topScore: 0.55,
            degraded: false,
            staleExcludedCount: 0,
            duplicateExcludedCount: 0,
          },
          notes: [],
        }),
      },
    );

    // ED-2: Story research fail-closed may surface as story_research_skip
    // (failureReason STORY_POINT_SKIPPED) or classic ACRB SKIP.
    expect(["AUDIENCE_CONTENT_RESEARCH_SKIPPED", "STORY_POINT_SKIPPED"]).toContain(
      result.run.failureReason,
    );
    expect(result.candidate).toBeNull();
    expect(requestDraft).not.toHaveBeenCalled();
    expect(requestGovernance).not.toHaveBeenCalled();
    if (result.audienceContentResearchBrief) {
      expect(result.audienceContentResearchBrief.researchVerdict).toBe("SKIP");
    }
  });

  it("governance receives ACRB compact context", () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const brief = buildDeterministicAcrb({ gathered: emptyGathered(handoff) });
    const gov = prepareContentToGovernanceHandoff({
      draft: {
        title: "t",
        body: "안전한 참고용 초안입니다.",
        channel: "threads",
        agenda: handoff.selectedAgenda.title,
        sourceReferences: [],
        assignmentId: handoff.contentAssignment.assignmentId,
      },
      assignment: handoff.contentAssignment,
      selectedAgenda: handoff.selectedAgenda,
      contentPlan: handoff.contentPlanScaffold,
      productId: "prod_test",
      channel: "threads",
      audienceContentResearchBrief: brief,
    });
    expect(gov.request.audienceContentResearch?.researchBriefId).toBe(brief.id);
    expect(gov.request.constraints.some((c) => /hypothesis|inference|research_limitation/i.test(c))).toBe(
      true,
    );
  });

  it("package export includes ACRB artifact and compact ref", () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const brief = buildDeterministicAcrb({ gathered: emptyGathered(handoff) });
    const root = mkdtempSync(join(tmpdir(), "acrb-export-"));
    try {
      const candidate = {
        contract: "completed-marketing-candidate-v1" as const,
        candidateId: "cmc_acrb_export_test",
        runId: "run_1",
        logicalRunKey: "daily-marketing-production:2026-09-12:acrbexporttest000001",
        businessDateKst: "2026-09-12",
        createdAt: "2026-09-12T12:00:00.000Z",
        updatedAt: "2026-09-12T12:00:00.000Z",
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentPlan: handoff.contentPlanScaffold,
        draft: {
          title: "t",
          body: "body",
          channel: "threads",
          agenda: handoff.selectedAgenda.title,
          sourceReferences: [],
        },
        governanceDecision: null,
        status: "needs_human_review" as const,
        revisionHistory: [],
        provenance: {
          routineId: "daily-marketing-plan",
          correlationId: "c",
          researchStatus: null,
          governanceReviewId: null,
        },
        observability: {
          runId: "run_1",
          logicalRunKey: "k",
          businessDateKst: "2026-09-12",
          correlationId: "c",
          researchStatus: null,
          candidateCount: 0,
          selectedAgendaId: handoff.selectedAgenda.id,
          assignmentId: handoff.contentAssignment.assignmentId,
          governanceReviewId: null,
          revisionCount: 0,
          governanceDecision: null,
          finalCandidateId: null,
          finalStatus: null,
          startedAt: "2026-09-12T12:00:00.000Z",
          completedAt: null,
          failureReason: null,
        },
        audienceContentResearchRef: toAudienceContentResearchBriefRef(brief),
      };

      const result = exportMarketingCandidatePackage({
        candidate,
        assetRoot: root,
        audienceContentResearchBrief: brief,
        overwriteArtifacts: true,
      });
      const acrbPath = join(result.packageRoot, AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH);
      const parsed = parseAudienceContentResearchBrief(JSON.parse(readFileSync(acrbPath, "utf8")));
      expect(parsed?.id).toBe(brief.id);
      expect(
        result.manifest.artifacts.some(
          (a) => a.relativePath === AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH,
        ),
      ).toBe(true);
      const exportCtx = JSON.parse(
        readFileSync(join(result.packageRoot, "context/export-context.json"), "utf8"),
      );
      expect(exportCtx.audienceContentResearch.researchBriefId).toBe(brief.id);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("evidence fingerprint changes with new evidence", () => {
    const a = buildEvidenceFingerprint(busanSelection().evidenceRefs);
    const b = buildEvidenceFingerprint([
      ...busanSelection().evidenceRefs,
      {
        ...busanSelection().evidenceRefs[0]!,
        evidenceId: "new_evidence",
        excerpt: "다른 관측",
      },
    ]);
    expect(a).not.toBe(b);
  });
});
