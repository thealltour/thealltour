/**
 * Marketing Value — discovery Threads scoring + archetype provenance.
 * Covers false-negative fixes for Dao fixture and fallback order.
 */
import { describe, expect, it } from "vitest";

import { formatQualityRevisionPromptBlock } from "@/lib/marketing/publishable/composerRuntime";
import { evaluateMarketingValue } from "@/lib/marketing/value/evaluateMarketingValue";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import { PUBLISHABLE_CHANNEL_CONTENT_CONTRACT } from "@/lib/marketing/publishable/contracts";
import { resolveCanonicalAssetDomainContext } from "@/lib/marketing/canonicalAsset/resolveCanonicalAssetDomainContext";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { CANONICAL_MARKETING_ASSET_CONTRACT } from "@/lib/marketing/canonicalAsset/contracts";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";

const DAO_THREADS_BODY = `다낭의 해변, 푸꾸옥의 리조트, 호치민과 하노이의 도시 풍경. 한국 여행자에게 익숙한 베트남의 모습입니다.

그런데 시선을 북부 국경지대로 옮기면 이야기가 달라집니다. Dao족과 전통 흙다짐 주택인 ‘nhà trình tường’에 관한 기록은 우리가 익숙하게 보아온 베트남 밖에 또 다른 생활문화가 있음을 보여줍니다.

해변 휴양이나 대도시 중심의 여행에서 접하는 풍경과는 완전히 다른 문화적 맥락입니다. 특정 마을 하나의 특별함보다, 베트남을 바라보는 시선 자체가 넓어진다는 점이 흥미롭습니다.

다만 현재 확인된 자료만으로 세부 마을의 위치나 현장에서 어떤 체험이 가능한지 구체적으로 말하기는 어렵습니다. 지금 확인할 수 있는 것은 공식 기록에 담긴 북부 지역의 다른 문화적 면모까지입니다.

익숙한 휴양과 도시 여행 외의 베트남에 관심이 생겼다면, 이후에 실제 방문 가능한 지역과 현장 정보를 차근히 살펴보는 편이 좋습니다.`;

function prop(overrides: Partial<ContentProposition> = {}): ContentProposition {
  return {
    contract: "content-proposition-v1",
    primaryAudience: "베트남 재방문 관심 여행자",
    audienceProblem: "베트남을 휴양지로만 본다",
    audienceTension: "익숙한 휴양 vs 다른 생활문화",
    whyNow: null,
    contentPromise:
      "북부 국경지대의 Dao족과 전통 건축(nhà trình tường)에 대한 공식 증거를 바탕으로 베트남의 다채로운 여행 경험 가능성을 안내한다.",
    readerGain: "베트남을 지역별 문화가 다른 국가로 인식한다",
    specificTakeaways: [
      "랑선 북부 산악 지대의 Dao족 거주 배경 확인",
      "전통 흙다짐 주택(nhà trình tường)의 건축적 특징 인식",
      "해양 휴양지 중심 일정과 북부 문화 탐방 일정의 성격 비교",
    ],
    proofRequirements: [],
    contentGapUsed: "",
    engagementMechanism: "save_worthy_checklist",
    desiredAudienceAction: "compare",
    angle: "discovery",
    keyMessage: "또 다른 베트남",
    commercialIntent: "informational",
    propositionStrength: "usable",
    limitations: [],
    ...overrides,
  } as ContentProposition;
}

function llmContent(body: string) {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "threads" as const,
    format: "threads_text" as const,
    title: null,
    body,
    status: "generated" as const,
    generatedAt: "2026-09-18T12:51:20.146Z",
    sourceCandidateId: "cmc_daily_marketing_production_2026_09_18_e0",
    sourceRevision: "r",
    provenance: {
      composer: "llm" as const,
      evidenceRefIds: [],
      commercialIntent: "informational",
      generationMode: "llm" as const,
    },
    validation: { ok: true, issues: [] },
    publishableSuccess: true,
  };
}

function score(body: string, editorialArchetype: string | null) {
  return evaluateMarketingValue({
    channel: "threads",
    body,
    content: llmContent(body),
    proposition: prop(),
    editorialArchetype,
  });
}

describe("Marketing Value discovery Threads (Dao fixture)", () => {
  it("A. authoritative discovery archetype disables checklist/actionable branch", () => {
    const a = score(DAO_THREADS_BODY, "discovery");
    expect(a.improvementHints.some((h) => /checklist/i.test(h))).toBe(false);
    expect(a.weaknesses.some((w) => /save_worthy_checklist/i.test(w))).toBe(false);
    expect(a.engagementPotentialScore).toBeGreaterThanOrEqual(65);
    expect(a.overallScore).toBeGreaterThanOrEqual(70);
    expect(["publishable", "strong"]).toContain(a.verdict);
  });

  it("B. null archetype + discovery body heuristic fallback works", () => {
    const a = score(DAO_THREADS_BODY, null);
    expect(a.improvementHints.some((h) => /checklist worth saving/i.test(h))).toBe(false);
    expect(a.improvementHints.some((h) => /sharp insight plus a concrete takeaway/i.test(h))).toBe(
      false,
    );
    expect(a.overallScore).toBeGreaterThanOrEqual(70);
  });

  it("C. decision/practical save-worthy checklist scoring remains active", () => {
    const body =
      "직항과 경유를 먼저 비교하세요. 1) 출발 시간 2) 포함 여부 3) 환승 대기. 체크리스트로 저장해 두세요.";
    const good = evaluateMarketingValue({
      channel: "threads",
      body,
      content: llmContent(body),
      proposition: prop({
        engagementMechanism: "save_worthy_checklist",
        desiredAudienceAction: "save",
      }),
      editorialArchetype: "practical",
    });
    expect(good.engagementPotentialScore).toBeGreaterThanOrEqual(70);

    const missing = evaluateMarketingValue({
      channel: "threads",
      body: "여행은 미리 생각해 두면 좋습니다. 공식 사이트를 확인하세요.",
      content: llmContent("여행은 미리 생각해 두면 좋습니다. 공식 사이트를 확인하세요."),
      proposition: prop({
        engagementMechanism: "save_worthy_checklist",
        desiredAudienceAction: "save",
      }),
      editorialArchetype: "practical",
    });
    expect(missing.improvementHints.some((h) => /checklist worth saving/i.test(h))).toBe(true);
  });

  it("D. exact Dao fixture — component breakdown + no false hints", () => {
    expect(DAO_THREADS_BODY.length).toBeLessThanOrEqual(500);
    const a = score(DAO_THREADS_BODY, null);
    expect(a.improvementHints.some((h) => /checklist worth saving/i.test(h))).toBe(false);
    expect(a.improvementHints.some((h) => /sharp insight plus a concrete takeaway/i.test(h))).toBe(
      false,
    );
    expect(a.audienceRelevanceScore).toBeGreaterThanOrEqual(60);
    expect(a.hookStrengthScore).toBeGreaterThanOrEqual(65);
    expect(a.noveltyScore).toBeGreaterThanOrEqual(60);
    expect(a.specificityScore).toBeGreaterThanOrEqual(65);
    expect(a.overallScore).toBeGreaterThanOrEqual(70);
    // eslint-disable-next-line no-console
    console.log("Dao fixture AFTER breakdown", {
      len: DAO_THREADS_BODY.length,
      overall: a.overallScore,
      verdict: a.verdict,
      audienceRelevanceScore: a.audienceRelevanceScore,
      specificityScore: a.specificityScore,
      usefulnessScore: a.usefulnessScore,
      noveltyScore: a.noveltyScore,
      hookStrengthScore: a.hookStrengthScore,
      payoffScore: a.payoffScore,
      engagementPotentialScore: a.engagementPotentialScore,
      propositionAlignmentScore: a.propositionAlignmentScore,
      evidenceAdequacyForPromiseScore: a.evidenceAdequacyForPromiseScore,
      hints: a.improvementHints,
      reasons: a.reasons,
    });
  });

  it("E. audience relevance — discovery context positive; generic unrelated low", () => {
    const dao = score(DAO_THREADS_BODY, "discovery");
    expect(dao.audienceRelevanceScore).toBeGreaterThanOrEqual(60);

    const generic =
      "여행은 참 즐겁습니다. 아름다운 풍경을 만나보세요. 좋은 추억을 만드세요. 새로운 여행을 떠나보세요.";
    const g = score(generic, "discovery");
    expect(g.audienceRelevanceScore).toBeLessThan(dao.audienceRelevanceScore);
    expect(g.audienceRelevanceScore).toBeLessThan(60);
  });

  it("F. hook — familiar→contrast scores; generic intro stays low", () => {
    const dao = score(DAO_THREADS_BODY, "discovery");
    expect(dao.hookStrengthScore).toBeGreaterThanOrEqual(65);

    const genericIntro =
      "오늘은 베트남을 소개합니다. 아름다운 여행지입니다. 많은 사람들이 찾습니다. 계획을 잘 세우세요.";
    const g = score(genericIntro, "discovery");
    expect(g.hookStrengthScore).toBeLessThan(55);
  });

  it("G. novelty — overlooked cultural detail scores; bare '새로운 여행' does not", () => {
    const dao = score(DAO_THREADS_BODY, "discovery");
    expect(dao.noveltyScore).toBeGreaterThanOrEqual(60);

    const buzzword =
      "새로운 여행, 새로운 경험을 만나보세요. 베트남은 참 다양합니다. 참고하세요.";
    const b = score(buzzword, "discovery");
    expect(b.noveltyScore).toBeLessThanOrEqual(58);
  });

  it("H. specificity — named cultural/architectural counts; generic destination does not", () => {
    const dao = score(DAO_THREADS_BODY, "discovery");
    expect(dao.specificityScore).toBeGreaterThanOrEqual(65);

    const genericDest =
      "베트남은 아름다운 나라입니다. 해변도 있고 도시도 있습니다. 여행을 계획할 때 참고하세요.";
    const g = score(genericDest, "discovery");
    expect(g.specificityScore).toBeLessThan(dao.specificityScore);
  });

  it("I. proposition authority — stale compare/checklist does not override discovery", () => {
    const a = score(DAO_THREADS_BODY, "discovery");
    expect(a.improvementHints.some((h) => /checklist/i.test(h))).toBe(false);
    expect(a.weaknesses.some((w) => /save_worthy_checklist|compare/i.test(w))).toBe(false);
    expect(a.engagementPotentialScore).toBeGreaterThanOrEqual(70);
  });

  it("J. null archetype regression — safe fallback; not every travel body is discovery", () => {
    const generic =
      "여행 준비에 도움되는 정보를 제공합니다. 관심 있는 사람은 참고하세요. 미리 확인하세요.";
    const a = evaluateMarketingValue({
      channel: "threads",
      body: generic,
      content: llmContent(generic),
      proposition: prop(),
      editorialArchetype: null,
    });
    expect(a.improvementHints.some((h) => /checklist worth saving/i.test(h))).toBe(true);
    expect(() => score(DAO_THREADS_BODY, null)).not.toThrow();
  });

  it("K. weak discovery body still needs_improvement with discovery-specific hint", () => {
    const weak =
      "베트남은 참 다양합니다. 여행을 계획할 때 참고하세요. 다양한 정보를 비교하면 도움이 됩니다.";
    const a = evaluateMarketingValue({
      channel: "threads",
      body: weak,
      content: llmContent(weak),
      proposition: prop({ engagementMechanism: "experience_sharing_prompt" }),
      editorialArchetype: "cultural_curiosity",
    });
    expect(["needs_improvement", "reject"]).toContain(a.verdict);
    expect(a.improvementHints.some((h) => /checklist worth saving/i.test(h))).toBe(false);
    if (a.verdict === "needs_improvement") {
      expect(a.improvementHints.length).toBeGreaterThan(0);
    }
  });

  it("qualityRevision filters checklist hints for discovery prior bodies", () => {
    const block = formatQualityRevisionPromptBlock(
      {
        reasons: ["weak"],
        hints: [
          "Provide a concrete 2–3 item checklist worth saving.",
          "Threads needs a clearer curiosity contrast, overlooked detail, or concrete recognition.",
        ],
        priorBody: DAO_THREADS_BODY,
      },
      null,
    );
    expect(block).not.toMatch(/checklist worth saving/i);
    expect(block).toMatch(/Do not force a checklist/i);
  });
});

describe("editorialArchetype provenance recovery", () => {
  function stubCandidate(asset: CanonicalMarketingAsset): CompletedMarketingCandidate {
    return {
      contract: "completed-marketing-candidate-v1",
      candidateId: "cand_1",
      runId: "run_1",
      logicalRunKey: "lrk_1",
      businessDateKst: "2026-09-18",
      createdAt: "2026-09-18T00:00:00.000Z",
      updatedAt: "2026-09-18T00:00:00.000Z",
      selectedAgenda: {
        contract: "selected-agenda-v1",
        id: "sa_1",
        decidedAt: "2026-09-18T00:00:00.000Z",
        title: "t",
        summary: "s",
        rationale: [],
        destinations: [],
        topics: [],
        entities: [],
        contentObjective: "inform",
        audienceHint: null,
        commercialIntent: "informational",
        matchedProductIds: [],
        evidenceRefs: [],
        constraints: [],
        urgency: "normal",
        timelinessNote: null,
        provenance: {
          decidedBy: "marketing-manager",
          managerDecisionSource: "explicit",
          researchScoreAtSelection: null,
          agendaCandidateId: null,
          researchBriefId: null,
        },
      },
      contentAssignment: {
        contract: "content-assignment-v1",
        assignmentId: "asg_1",
        createdAt: "2026-09-18T00:00:00.000Z",
        selectedAgendaId: "sa_1",
        selectedAgendaTitle: "t",
        objective: "inform",
        topic: "t",
        audience: null,
        destinations: [],
        facts: [],
        commercialIntent: "informational",
        matchedProductIds: [],
        constraints: [],
        formatHints: [],
        requiredOutputs: ["text_draft"],
        deadline: null,
        evidenceRefs: [],
        riskNotes: [],
        provenance: {
          selectedAgendaId: "sa_1",
          createdBy: "marketing-manager-handoff",
          idempotencyKey: "asg_1",
        },
      },
      contentPlan: null,
      draft: {
        body: "body",
        channel: "threads",
        agenda: null,
        sourceReferences: [],
      },
      governanceDecision: null,
      status: "ready_for_human_review",
      revisionHistory: [],
      provenance: {
        routineId: "daily",
        correlationId: "corr",
        researchStatus: null,
        governanceReviewId: null,
      },
      observability: {
        runId: "run_1",
        logicalRunKey: "lrk_1",
        businessDateKst: "2026-09-18",
        correlationId: "corr",
        researchStatus: null,
        candidateCount: 1,
        selectedAgendaId: "sa_1",
        assignmentId: "asg_1",
        governanceReviewId: null,
        revisionCount: 0,
        governanceDecision: null,
        finalCandidateId: "cand_1",
        finalStatus: "ready_for_human_review",
        startedAt: "2026-09-18T00:00:00.000Z",
        completedAt: "2026-09-18T00:00:00.000Z",
        failureReason: null,
      },
      canonicalMarketingAsset: asset,
    };
  }

  function approvedAsset(archetype: string): CanonicalMarketingAsset {
    return {
      contract: CANONICAL_MARKETING_ASSET_CONTRACT,
      assetId: "asset_dao",
      version: 1,
      status: "approved",
      agendaId: "agenda_1",
      storyPointId: "sp_dao",
      storyPointHash: "hash_dao",
      evidenceBriefRef: null,
      evidenceRevision: "ev",
      contentPropositionRef: null,
      propositionRevision: "pr",
      sourceRevision: "sr",
      titleKo: "또 다른 베트남",
      dekKo: null,
      openingHookKo: "익숙한 해변 너머",
      bodyKo: "본문입니다. ".repeat(40),
      keyTakeawaysKo: ["Dao족"],
      decisionGuidanceKo: "단정하지 말 것",
      optionalCtaIntentKo: null,
      evidenceRefs: [],
      limitationsKo: [],
      forbiddenClaimsKo: [],
      supportedClaimBoundaryKo: null,
      unresolvedQuestionsKo: [],
      storySupportVerdict: "SUPPORTED_WITH_LIMITS",
      generatedAt: "2026-09-18T00:00:00.000Z",
      editedAt: null,
      approvedAt: "2026-09-18T01:00:00.000Z",
      approvedVersion: 1,
      humanEdited: false,
      approvalSource: "ai_original",
      approvedBy: "op",
      generatedBy: "asset-source-writer",
      repairCount: 0,
      validationIssues: [],
      editorialArchetype: archetype,
    } as CanonicalMarketingAsset;
  }

  it("lock-only Story stub recovers archetype from approved asset field", () => {
    const asset = approvedAsset("discovery");
    const ctx = resolveCanonicalAssetDomainContext({
      candidate: stubCandidate(asset),
      packageRoot: null,
      storyPointCandidateSet: null,
    });
    expect(ctx.storyPoint?.editorialArchetype).toBe("discovery");
  });

  it("legacy asset without editorialArchetype stays null (no invention)", () => {
    const asset = approvedAsset("discovery");
    delete (asset as { editorialArchetype?: string | null }).editorialArchetype;
    const ctx = resolveCanonicalAssetDomainContext({
      candidate: stubCandidate(asset),
      packageRoot: null,
      storyPointCandidateSet: null,
    });
    expect(ctx.storyPoint?.editorialArchetype ?? null).toBeNull();
  });
});
