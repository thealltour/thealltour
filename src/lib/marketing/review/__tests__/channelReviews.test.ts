import { describe, expect, it } from "vitest";

import {
  channelLabel,
  effectiveChannelDraft,
  emptyChannelReviewEntry,
} from "@/lib/marketing/review/channelReviews";
import { mergeChannelReviewsFromPublishable, visibleChannelsFromReviews } from "@/lib/marketing/review/mergeChannelReviews";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import { createInitialHumanReview } from "@/lib/marketing/review/dto";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { HumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { createInMemoryHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";

function makeCandidate(): CompletedMarketingCandidate {
  return {
    contract: "completed-marketing-candidate-v1",
    candidateId: "cmc_cg4c_test",
    runId: "run_cg4c",
    logicalRunKey: "daily-marketing-production:2026-09-13:cg4c0001",
    businessDateKst: "2026-09-13",
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    selectedAgenda: {
      id: "a1",
      title: "부산 출발 크루즈 추석 탑승 가이드 콘텐츠 관측",
      summary: "탑승 직전",
      destinations: ["부산"],
      entities: [],
      contentObjective: "inform",
      commercialIntent: "informational",
      rationale: [],
      timelinessNote: null,
      evidenceRefs: [],
      provenance: { researchScoreAtSelection: 0.5 },
    },
    contentAssignment: {
      contract: "content-assignment-v1",
      assignmentId: "asg1",
      selectedAgendaId: "a1",
      objective: "inform",
      topic: "부산 크루즈",
      audience: "가족",
      commercialIntent: "informational",
      facts: [],
      evidenceRefs: [],
      formatHints: [],
      destinations: ["부산"],
      matchedProductIds: [],
      riskNotes: [],
      constraints: [],
      requiredOutputs: ["content_plan", "text_draft"],
      deadline: null,
      provenance: { createdFrom: "test" },
    },
    contentPlan: {
      contract: "content-plan-v1",
      assignmentId: "asg1",
      recommendedFormats: [],
      targetChannels: ["threads", "shortform", "naver_blog", "naver_band", "kakao_channel"],
      primaryAngle: "첫 크루즈, 배 안보다 탑승 직전이 더 헷갈린다",
      keyMessage: "탑승 직전",
      targetAudience: "가족",
      hook: "동선",
      outline: [],
      factsToUse: [],
      factsToAvoid: [],
      ctaStrategy: "soft",
      productLinkageStrategy: "none",
      evidenceRefs: [],
      requiredAssets: [],
      riskNotes: [],
      draftInstructions: [],
    },
    draft: {
      title: "t",
      body: "threads body",
      channel: "threads",
      agenda: null,
      sourceReferences: [],
      contentPlan: null,
      assignmentId: "asg1",
    },
    governanceDecision: {
      decision: "ALLOW",
      riskScore: 0.1,
      reasons: [],
      revisionHints: [],
      requiredRevisions: [],
      humanApprovalRequired: false,
      semanticAvailable: false,
      unsupportedClaims: [],
      verifiedEvidenceRefs: [],
    },
    status: "ready_for_human_review",
    revisionHistory: [],
    provenance: {
      routineId: "r",
      correlationId: "c",
      researchStatus: "complete",
      governanceReviewId: null,
    },
    observability: { stages: {}, timingsMs: {}, modelCalls: 0 },
  } as CompletedMarketingCandidate;
}

function sampleBundle(): PublishableContentBundle {
  const base = {
    contract: "publishable-channel-content-v1" as const,
    status: "generated" as const,
    generatedAt: "2026-09-13T00:00:00.000Z",
    sourceCandidateId: "cmc_cg4c_test",
    sourceRevision: "rev1",
    provenance: {
      composer: "deterministic_fallback" as const,
      evidenceRefIds: [],
      commercialIntent: "informational",
    },
    validation: { ok: true, issues: [] },
  };
  return {
    contract: "publishable-channel-content-bundle-v1",
    candidateId: "cmc_cg4c_test",
    businessDateKst: "2026-09-13",
    generatedAt: "2026-09-13T00:00:00.000Z",
    sourceRevision: "rev1",
    targetChannels: ["threads", "shortform", "naver_blog", "naver_band", "kakao_channel"],
    threads: {
      ...base,
      channel: "threads",
      format: "threads_text",
      title: null,
      body: "threads publishable",
    },
    shortform: {
      ...base,
      channel: "shortform",
      format: "short_video_narration",
      title: null,
      body: "shortform narration",
    },
    naver_blog: {
      ...base,
      channel: "naver_blog",
      format: "naver_blog_article",
      title: "블로그 제목",
      body: "# 블로그 제목\n\n## 섹션\n본문",
    },
    naver_band: {
      ...base,
      channel: "naver_band",
      format: "naver_band_post",
      title: null,
      body: "밴드 본문인가요?",
    },
    kakao_channel: {
      ...base,
      channel: "kakao_channel",
      format: "kakao_channel_post",
      title: null,
      body: "카카오 짧은 안내",
    },
  };
}

describe("CG-4C multi-channel human review", () => {
  it("merges only generated channels into review map", () => {
    const map = mergeChannelReviewsFromPublishable({ bundle: sampleBundle() });
    expect(visibleChannelsFromReviews(map)).toEqual([
      "threads",
      "naver_blog",
      "naver_band",
      "kakao_channel",
      "shortform",
    ]);
    expect(channelLabel("naver_blog")).toBe("Naver Blog");
  });

  it("human draft takes precedence over AI draft", () => {
    const entry = emptyChannelReviewEntry("naver_blog", {
      title: "AI",
      body: "ai body",
    });
    entry.humanDraft = { title: "Human", body: "human body" };
    expect(effectiveChannelDraft(entry)).toEqual({
      title: "Human",
      body: "human body",
      source: "human",
    });
  });

  it("visibleChannelsFromReviews tolerates partial entries without aiDraft", () => {
    const map = {
      threads: {
        channel: "threads" as const,
        status: "needs_review" as const,
        aiDraft: undefined as unknown as { title: string | null; body: string },
        humanDraft: { title: null, body: "human only body" },
        validationWarnings: [],
        lastEditedAt: null,
        approvedAt: null,
        skippedAt: null,
        notes: null,
      },
      naver_band: {
        channel: "naver_band" as const,
        status: "draft" as const,
        // intentionally incomplete payload shape
        humanDraft: null,
        validationWarnings: undefined as unknown as string[],
        lastEditedAt: null,
        approvedAt: null,
        skippedAt: null,
        notes: null,
      } as any,
    };
    expect(() => visibleChannelsFromReviews(map)).not.toThrow();
    expect(visibleChannelsFromReviews(map)).toEqual(["threads"]);
    expect(effectiveChannelDraft(map.threads)).toEqual({
      title: null,
      body: "human only body",
      source: "human",
    });
  });

  it("channel-scoped save/approve/skip isolation + governance block", async () => {
    const candidate = makeCandidate();
    const candidateRepo = createInMemoryDailyMarketingRunRepository();
    await candidateRepo.saveCandidate(candidate);
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const initial = createInitialHumanReview(candidate, "tester");
    initial.channelReviews = mergeChannelReviewsFromPublishable({ bundle: sampleBundle() });
    await reviewRepo.save(initial);

    const service = new HumanMarketingReviewService({
      candidateRepo,
      reviewRepo,
      now: () => new Date("2026-09-13T01:00:00.000Z"),
    });

    const afterBlog = await service.updateChannelReviewDraft({
      candidateId: candidate.candidateId,
      channel: "naver_blog",
      title: "사람 블로그 제목",
      body: "# 사람 블로그\n\n수정본",
      reviewedBy: "tester",
    });
    expect(afterBlog.channelReviews?.naver_blog?.humanDraft?.title).toBe("사람 블로그 제목");
    expect(afterBlog.channelReviews?.naver_band?.humanDraft).toBeNull();
    expect(afterBlog.channelReviews?.naver_band?.aiDraft.body).toContain("밴드");

    const approved = await service.setChannelReviewStatus({
      candidateId: candidate.candidateId,
      channel: "naver_blog",
      status: "approved",
      reviewedBy: "tester",
    });
    expect(approved.channelReviews?.naver_blog?.status).toBe("approved");
    expect(approved.status).toBe("approved_for_manual_publish");

    const skipped = await service.setChannelReviewStatus({
      candidateId: candidate.candidateId,
      channel: "kakao_channel",
      status: "skipped",
      reviewedBy: "tester",
    });
    expect(skipped.channelReviews?.kakao_channel?.status).toBe("skipped");
    expect(skipped.channelReviews?.naver_blog?.status).toBe("approved");

    // BLOCK prevents approval — distinct logicalRunKey required by in-memory repo
    const blockedCandidate = {
      ...candidate,
      candidateId: "cmc_cg4c_blocked",
      logicalRunKey: "daily-marketing-production:2026-09-13:cg4cblocked",
      status: "blocked" as const,
      governanceDecision: {
        ...candidate.governanceDecision!,
        decision: "BLOCK" as const,
      },
    };
    await candidateRepo.saveCandidate(blockedCandidate);
    const blockedReview = createInitialHumanReview(blockedCandidate, "tester");
    blockedReview.channelReviews = mergeChannelReviewsFromPublishable({ bundle: sampleBundle() });
    await reviewRepo.save(blockedReview);
    await expect(
      service.setChannelReviewStatus({
        candidateId: blockedCandidate.candidateId,
        channel: "threads",
        status: "approved",
        reviewedBy: "tester",
      }),
    ).rejects.toThrow(/governance_block/);
  });
});
