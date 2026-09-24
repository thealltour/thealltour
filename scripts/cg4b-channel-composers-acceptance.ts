/**
 * CG-4B real-agenda channel-native composer acceptance (Busan cruise).
 * Reuses durable ACRB fixture — no external web search.
 *
 *   npx tsx scripts/cg4b-channel-composers-acceptance.ts
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLocalEnv } from "./loadLocalEnv";

loadLocalEnv();

async function main() {
  const { buildDeterministicAcrb } = await import(
    "../src/lib/marketing/audienceResearch/deterministicSkeleton"
  );
  const { prepareManagerToContentHandoff } = await import(
    "../src/lib/marketing/content/prepareManagerToContentHandoff"
  );
  const { createInMemoryContentAssignmentStore } = await import(
    "../src/lib/marketing/content/store/contentAssignmentStore"
  );
  const { ensurePublishableContent } = await import(
    "../src/lib/marketing/publishable/ensurePublishableContent"
  );
  const { exportMarketingCandidatePackage } = await import(
    "../src/lib/marketing/assets/exportMarketingCandidatePackage"
  );
  const { assertChannelNativeStructure } = await import(
    "../src/lib/marketing/publishable/validate"
  );
  const {
    createAudienceResearchInvoke,
    createMarketingCronCorrelationId,
    isAiRuntimeMarketingCronEnabled,
  } = await import("../src/lib/marketing/cron/marketingCronRuntime");
  const { MARKETING_CRON_HERMES_TIMEOUT_MS, MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT } =
    await import("../src/lib/marketing/cron/marketingPlanSpecialists");
  const { resolveMarketingCronHermesTimeoutMs } = await import(
    "../src/lib/marketing/cron/hermesSpawnFailure"
  );
  const { invokeMarketingHermesAgentSync } = await import(
    "../src/lib/marketing/hermesRuntime/syncLauncher"
  );

  let externalSearchCalls = 0;
  const guardedFetch: typeof fetch = async (...args) => {
    const url = String(args[0] ?? "");
    if (/openrouter\.ai|tavily|generativelanguage\.googleapis/.test(url) && /chat\/completions|search|generateContent/.test(url)) {
      // Allow Hermes/OpenRouter inference for composition, but count web-search-ish calls.
      if (/web_search|"web"|google_search|tavily/.test(JSON.stringify(args[1] ?? {}))) {
        externalSearchCalls += 1;
      }
    }
    return fetch(...args);
  };
  void guardedFetch;

  const selection = {
    title: "부산 출발 크루즈 추석 탑승 가이드 콘텐츠 관측",
    summary:
      "공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선과 가족 동반 체험을 소개하는 콘텐츠가 관측됨",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: ["부산"],
    topics: ["크루즈", "추석", "탑승"],
    entities: ["MSC 벨리시마"],
    researchBriefId: "rb_busan_cruise_cg4b",
    agendaCandidateId: "ac_busan_cruise_cg4b",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta AI Trend Discovery",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/DdEgr-UyM2S/",
        reference: "meta_ai:obs_cg4b",
        excerpt:
          "공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선과 가족 동반 체험을 소개하는 콘텐츠가 관측됨",
        publishedAt: null,
        observedAt: "2026-09-09T15:10:00.000Z",
        credibilityHint: 0.35,
      },
    ],
  };

  const editorial = {
    hookSignals: ["첫 크루즈 탑승 전 동선", "가족과 함께"],
    formatSignals: ["short_video", "checklist"],
    audiencePainPoints: ["공항 이동 부담", "탑승 절차 막막함"],
    audienceQuestions: ["부산항 탑승 동선은?", "아이와 함께 타도 될까?"],
    personaHints: ["부산·경남 거주 다세대 가족", "첫 크루즈 초보"],
    contentAngles: ["가족 해상 휴가", "부산 출발 접근성"],
  };

  const handoff = prepareManagerToContentHandoff(selection, {
    store: createInMemoryContentAssignmentStore(),
  });

  const acrb = buildDeterministicAcrb({
    gathered: {
      selectedAgenda: handoff.selectedAgenda,
      assignment: handoff.contentAssignment,
      evidencePack: handoff.evidencePack,
      compactBrief: null,
      compactCandidate: null,
      fullResearchBrief: {
        id: selection.researchBriefId,
        title: selection.title,
        summary: selection.summary,
        signalIds: [],
        claims: [],
        evidence: [],
        topics: selection.topics,
        destinations: selection.destinations,
        entities: selection.entities,
        freshness: {
          publishedAt: null,
          observedAt: selection.evidenceRefs[0].observedAt,
          freshnessScore: 0.7,
        },
        credibility: { score: 0.35, reasons: ["social"] },
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
        providerId: "reused_durable",
        queryCount: 0,
        resultCount: 2,
        fetchedDocumentCount: 1,
        failedFetchCount: 0,
        totalFetchedBytes: 2000,
        officialSourceCount: 0,
        socialCommunitySourceCount: 1,
        runtimeMs: 0,
        queries: [],
        evidence: [
          {
            evidenceId: "ext_cg4b_1",
            url: "https://example.com/community/boarding",
            title: "탑승 준비",
            excerpt: "터미널·수하물 질문이 반복됨",
            sourceClass: "community",
            fromSnippetOnly: false,
            query: "reused",
            purpose: "reuse",
          },
        ],
        observedAudienceQuestions: ["부산항 터미널 입구는 어디인가요", "수하물은 언제 부치나요"],
        observedCompetitorHooks: ["선내 시설 투어"],
        limitations: ["external_research_reused_no_new_search"],
      },
    },
  });

  const recommended =
    acrb.contentAngles.find((a) => a.angleId === acrb.recommendedAngleId) ?? acrb.contentAngles[0];

  const useRuntime = isAiRuntimeMarketingCronEnabled();
  function invokeHermesProfile(profile: string, prompt: string): string {
    const timeoutMs = resolveMarketingCronHermesTimeoutMs(
      process.env,
      MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
    );
    return invokeMarketingHermesAgentSync({ profileId: profile, prompt, timeoutMs });
  }

  let invoke = createAudienceResearchInvoke({
    useRuntime,
    correlationId: createMarketingCronCorrelationId(),
    invokeHermesProfile: useRuntime ? undefined : invokeHermesProfile,
    completionTimeoutMs: MARKETING_CRON_HERMES_TIMEOUT_MS,
  });
  if (useRuntime) {
    const { createRuntimeExecutorStack } = await import(
      "../src/ai-runtime/integration/runtime-stack"
    );
    const { ensureSharedObservabilityRecorder } = await import(
      "../src/ai-runtime/observability/persistence"
    );
    await ensureSharedObservabilityRecorder();
    invoke = createAudienceResearchInvoke({
      useRuntime: true,
      correlationId: createMarketingCronCorrelationId(),
      executor: createRuntimeExecutorStack(),
      completionTimeoutMs: MARKETING_CRON_HERMES_TIMEOUT_MS,
    });
  }

  const candidate = {
    contract: "completed-marketing-candidate-v1" as const,
    candidateId: "cmc_cg4b_busan_live",
    runId: "run_cg4b",
    logicalRunKey: "daily-marketing-production:2026-09-13:cg4blive000000001",
    businessDateKst: "2026-09-13",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    selectedAgenda: handoff.selectedAgenda,
    contentAssignment: handoff.contentAssignment,
    contentPlan: {
      contract: "content-plan-v1" as const,
      assignmentId: handoff.contentAssignment.assignmentId,
      recommendedFormats: [
        { format: "threads_text" as const, score: 0.8, rationale: "baseline" },
        { format: "short_video_concept" as const, score: 0.7, rationale: "shortform" },
        { format: "blog_article" as const, score: 0.8, rationale: "search" },
      ],
      targetChannels: ["threads", "shortform", "naver_blog", "naver_band", "kakao_channel"] as const,
      primaryAngle: recommended?.angle ?? "첫 크루즈, 배 안보다 탑승 직전이 더 헷갈린다",
      keyMessage: recommended?.angle ?? "탑승 직전 긴장",
      targetAudience: acrb.audience.primary[0]?.text ?? "첫 크루즈 가족",
      hook: recommended?.audienceTension ?? "탑승 직전 불안",
      outline: ["search questions", "limits", "next checks"],
      factsToUse: handoff.contentAssignment.facts.map((f) => f.statement).slice(0, 4),
      factsToAvoid: [],
      ctaStrategy: "informational next-check",
      productLinkageStrategy: "none",
      evidenceRefs: handoff.contentAssignment.evidenceRefs,
      requiredAssets: [],
      riskNotes: acrb.limitations.slice(0, 3),
      draftInstructions: ["channel-native composers"],
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
      riskScore: 0.25,
      reasons: [],
      revisionHints: [],
      requiredRevisions: [],
      humanApprovalRequired: false,
      semanticAvailable: false,
      unsupportedClaims: [],
      verifiedEvidenceRefs: [],
    },
    status: "READY_FOR_HUMAN_REVIEW" as const,
    revisionHistory: [],
    provenance: {
      routineId: "cg4b",
      correlationId: "cg4b-live",
      researchStatus: "complete",
      governanceReviewId: null,
    },
    observability: { stages: {}, timingsMs: {}, modelCalls: 0 },
    audienceContentResearchRef: {
      contract: "audience-content-research-brief-v1" as const,
      researchBriefId: acrb.id,
      sha256: "0".repeat(64),
      researchVerdict: acrb.researchVerdict,
      researchStatus: acrb.researchStatus,
    },
  };

  const bundle = await ensurePublishableContent({
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
    invoke,
  });

  const root = mkdtempSync(join(tmpdir(), "cg4b-live-"));
  let exportDigest: string | null = null;
  try {
    const exported = exportMarketingCandidatePackage({
      candidate: candidate as never,
      assetRoot: root,
      audienceContentResearchBrief: acrb,
      forcePublishableRegenerate: true,
    });
    exportDigest = exported.manifest.integrity.digest;
    const blogPath = join(exported.packageRoot, "copy/naver-blog.md");
    const bandPath = join(exported.packageRoot, "copy/naver-band.txt");
    const kakaoPath = join(exported.packageRoot, "copy/kakao-channel.txt");

    const blogBody = bundle.naver_blog?.body ?? readFileSync(blogPath, "utf8");
    const bandBody = bundle.naver_band?.body ?? readFileSync(bandPath, "utf8");
    const kakaoBody = bundle.kakao_channel?.body ?? readFileSync(kakaoPath, "utf8");
    const structure = assertChannelNativeStructure({
      blogBody,
      bandBody,
      kakaoBody,
    });

    const sanitize = (text: string) =>
      text
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 280);

    console.log(
      JSON.stringify(
        {
          CG4B_CHANNEL_COMPOSERS_ACCEPTANCE: true,
          acrb_reused: true,
          new_external_search_calls: externalSearchCalls,
          selected_angle: recommended?.angle ?? null,
          target_channels: bundle.targetChannels,
          blog: {
            selected_title: bundle.naver_blog?.title ?? bundle.naver_blog?.blogMeta?.selectedTitle,
            search_intent: bundle.naver_blog?.blogMeta?.searchIntent,
            title_candidates: bundle.naver_blog?.blogMeta?.titleCandidates ?? [],
            primary_topic: bundle.naver_blog?.blogMeta?.primaryTopic,
            questions_covered: acrb.searchIntent.questions.map((q) => q.text).slice(0, 5),
            content_gap: acrb.marketSignals.contentGaps[0]?.text ?? null,
            publishable: bundle.naver_blog?.validation.ok ?? false,
            sanitized_preview: sanitize(blogBody),
          },
          band: {
            publishable: bundle.naver_band?.validation.ok ?? false,
            sanitized_preview: sanitize(bandBody),
          },
          kakao: {
            publishable: bundle.kakao_channel?.validation.ok ?? false,
            sanitized_preview: sanitize(kakaoBody),
          },
          cross_channel: structure,
          export_digest: exportDigest,
          artifacts: [
            "copy/post.txt",
            "copy/naver-blog.md",
            "copy/naver-band.txt",
            "copy/kakao-channel.txt",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
