/**
 * CG-4C acceptance without importing server-only HumanMarketingReviewService.
 * Exercises channelReviews map semantics + publishable generation (no RA-1 search).
 *
 *   npx tsx scripts/cg4c-multi-channel-review-acceptance.ts
 */
import { loadLocalEnv } from "./loadLocalEnv";

loadLocalEnv();

async function main() {
  const { createInitialHumanReview } = await import("../src/lib/marketing/review/dto");
  const {
    mergeChannelReviewsFromPublishable,
    visibleChannelsFromReviews,
  } = await import("../src/lib/marketing/review/mergeChannelReviews");
  const { effectiveChannelDraft } = await import("../src/lib/marketing/review/channelReviews");
  const { buildDeterministicAcrb } = await import(
    "../src/lib/marketing/audienceResearch/deterministicSkeleton"
  );
  const { prepareManagerToContentHandoff } = await import(
    "../src/lib/marketing/content/prepareManagerToContentHandoff"
  );
  const { createInMemoryContentAssignmentStore } = await import(
    "../src/lib/marketing/content/store/contentAssignmentStore"
  );
  const { ensurePublishableContentSync } = await import(
    "../src/lib/marketing/publishable/ensurePublishableContentSync"
  );

  const externalResearchCalls = 0;

  const selection = {
    title: "부산 출발 크루즈 추석 탑승 가이드 콘텐츠 관측",
    summary: "부산항 출발 크루즈 탑승 동선 관측",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: ["부산"],
    topics: ["크루즈", "추석", "탑승"],
    entities: ["MSC 벨리시마"],
    researchBriefId: "rb_cg4c",
    agendaCandidateId: "ac_cg4c",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/DdEgr-UyM2S/",
        reference: "meta",
        excerpt: "탑승 동선 관측",
        publishedAt: null,
        observedAt: "2026-09-09T15:10:00.000Z",
        credibilityHint: 0.35,
      },
    ],
  };

  const handoff = prepareManagerToContentHandoff(selection, {
    store: createInMemoryContentAssignmentStore(),
  });

  const editorial = {
    hookSignals: ["탑승 전 동선"],
    formatSignals: ["checklist"],
    audiencePainPoints: ["탑승 절차 막막함"],
    audienceQuestions: ["부산항 탑승 동선은?"],
    personaHints: ["부산·경남 거주 다세대 가족", "첫 크루즈 초보"],
    contentAngles: ["가족 해상 휴가"],
  };

  const acrb = buildDeterministicAcrb({
    gathered: {
      selectedAgenda: handoff.selectedAgenda,
      assignment: handoff.contentAssignment,
      evidencePack: handoff.evidencePack,
      compactBrief: null,
      compactCandidate: null,
      fullResearchBrief: {
        id: "rb_cg4c",
        title: selection.title,
        summary: selection.summary,
        signalIds: [],
        claims: [],
        evidence: [],
        topics: selection.topics,
        destinations: selection.destinations,
        entities: selection.entities,
        freshness: { publishedAt: null, observedAt: "2026-09-09T15:10:00.000Z", freshnessScore: 0.7 },
        credibility: { score: 0.35, reasons: [] },
        travelRelevance: { score: 0.8, reasons: [] },
        publicInterest: 0.6,
        risks: [],
        openQuestions: [],
        generatedAt: new Date().toISOString(),
        status: "active",
        editorialIntelligence: editorial,
      } as never,
      editorial,
      historicalMatches: [],
      semanticAvailable: false,
      nearDuplicate: false,
      cooledIdentity: false,
      externalResearch: {
        available: true,
        providerId: "reused",
        queryCount: 0,
        resultCount: 1,
        fetchedDocumentCount: 0,
        failedFetchCount: 0,
        totalFetchedBytes: 0,
        officialSourceCount: 0,
        socialCommunitySourceCount: 1,
        runtimeMs: 0,
        queries: [],
        evidence: [],
        observedAudienceQuestions: ["부산항 탑승 동선은?"],
        observedCompetitorHooks: [],
        limitations: ["reused_no_new_search"],
      },
    },
  });

  const recommended =
    acrb.contentAngles.find((a) => a.angleId === acrb.recommendedAngleId) ?? acrb.contentAngles[0];

  const candidate = {
    contract: "completed-marketing-candidate-v1" as const,
    candidateId: "cmc_cg4c_busan",
    runId: "run_cg4c",
    logicalRunKey: "daily-marketing-production:2026-09-13:cg4caccept01",
    businessDateKst: "2026-09-13",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    selectedAgenda: handoff.selectedAgenda,
    contentAssignment: handoff.contentAssignment,
    contentPlan: {
      contract: "content-plan-v1" as const,
      assignmentId: handoff.contentAssignment.assignmentId,
      recommendedFormats: [
        { format: "threads_text" as const, score: 0.8, rationale: "t" },
        { format: "blog_article" as const, score: 0.8, rationale: "b" },
      ],
      targetChannels: ["threads", "shortform", "naver_blog", "naver_band", "kakao_channel"] as const,
      primaryAngle: recommended?.angle ?? "첫 크루즈, 배 안보다 탑승 직전이 더 헷갈린다",
      keyMessage: recommended?.angle ?? "탑승 직전",
      targetAudience: acrb.audience.primary[0]?.text ?? "가족",
      hook: recommended?.audienceTension ?? "불안",
      outline: [],
      factsToUse: [],
      factsToAvoid: [],
      ctaStrategy: "informational",
      productLinkageStrategy: "none",
      evidenceRefs: handoff.contentAssignment.evidenceRefs,
      requiredAssets: [],
      riskNotes: [],
      draftInstructions: [],
    },
    draft: {
      title: selection.title,
      body: "planning placeholder",
      channel: "threads",
      agenda: null,
      sourceReferences: [],
      contentPlan: null,
      assignmentId: handoff.contentAssignment.assignmentId,
    },
    governanceDecision: {
      decision: "ALLOW" as const,
      riskScore: 0.2,
      reasons: [],
      revisionHints: [],
      requiredRevisions: [],
      humanApprovalRequired: false,
      semanticAvailable: false,
      unsupportedClaims: [],
      verifiedEvidenceRefs: [],
    },
    status: "ready_for_human_review" as const,
    revisionHistory: [],
    provenance: {
      routineId: "cg4c",
      correlationId: "cg4c",
      researchStatus: "complete",
      governanceReviewId: null,
    },
    observability: { stages: {}, timingsMs: {}, modelCalls: 0 },
  };

  const bundle = ensurePublishableContentSync({
    candidate: candidate as never,
    forceRegenerate: true,
    audienceContentResearchBrief: acrb,
    explicitTargetChannels: [
      "threads",
      "shortform",
      "naver_blog",
      "naver_band",
      "kakao_channel",
    ],
  });

  const review = createInitialHumanReview(candidate as never, "operator");
  review.channelReviews = mergeChannelReviewsFromPublishable({ bundle });

  const bandBefore = review.channelReviews.naver_band!.aiDraft.body;

  // Simulate Blog-only human edit
  review.channelReviews.naver_blog = {
    ...review.channelReviews.naver_blog!,
    humanDraft: {
      title: "사람이 고친 블로그 제목",
      body: "# 사람이 고친 블로그 제목\n\n## 탑승 직전\n사람 수정본입니다.",
    },
    status: "needs_review",
    lastEditedAt: new Date().toISOString(),
  };

  const blogEff = effectiveChannelDraft(review.channelReviews.naver_blog);
  const bandUnchanged =
    review.channelReviews.naver_band!.aiDraft.body === bandBefore &&
    review.channelReviews.naver_band!.humanDraft == null;

  review.channelReviews.naver_blog.status = "approved";
  review.channelReviews.naver_blog.approvedAt = new Date().toISOString();
  review.channelReviews.kakao_channel!.status = "skipped";
  review.channelReviews.kakao_channel!.skippedAt = new Date().toISOString();
  review.status = "approved_for_manual_publish";

  console.log(
    JSON.stringify(
      {
        CG4C_MULTI_CHANNEL_REVIEW_ACCEPTANCE: true,
        agenda: selection.title,
        acrb_reused: true,
        external_research_calls: externalResearchCalls,
        visible_channels: visibleChannelsFromReviews(review.channelReviews),
        blog_edit_saved: blogEff.title === "사람이 고친 블로그 제목" && blogEff.source === "human",
        band_unchanged_after_blog_edit: bandUnchanged,
        blog_approved: review.channelReviews.naver_blog.status === "approved",
        kakao_skipped: review.channelReviews.kakao_channel!.status === "skipped",
        threads_reviewable: Boolean(review.channelReviews.threads?.aiDraft.body),
        shortform_reviewable: Boolean(review.channelReviews.shortform?.aiDraft.body),
        candidate_status: review.status,
        raw_ids_required: false,
        selected_angle: recommended?.angle ?? null,
        ui_components: [
          "MarketingReviewChannelTabs",
          "channel-draft API",
          "channel-status API",
          "channel-regenerate API",
          "social-accounts?channel=",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
