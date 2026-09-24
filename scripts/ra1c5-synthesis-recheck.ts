/**
 * RA-1C5 synthesis-only Busan agenda recheck.
 * Reuses durable/fixture external research — no new OpenRouter web search.
 *
 *   npx tsx scripts/ra1c5-synthesis-recheck.ts
 */
import { hostname } from "node:os";
import { loadLocalEnv } from "./loadLocalEnv";

loadLocalEnv();

async function main() {
  const {
    prepareManagerToContentHandoff,
  } = await import("../src/lib/marketing/content/prepareManagerToContentHandoff");
  const { createInMemoryContentAssignmentStore } = await import(
    "../src/lib/marketing/content/store/contentAssignmentStore"
  );
  const { ensureAudienceContentResearch } = await import(
    "../src/lib/marketing/audienceResearch/ensureAudienceContentResearch"
  );
  const { buildDeterministicAcrb } = await import(
    "../src/lib/marketing/audienceResearch/deterministicSkeleton"
  );
  const { createInMemoryMarketingProductionRequestRepository } = await import(
    "../src/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository"
  );
  const { MARKETING_PRODUCTION_REQUEST_CONTRACT } = await import(
    "../src/lib/marketing/cron/daily/agendaSlate/productionRequestTypes"
  );
  const { PRODUCTION_REQUEST_ACRB_METADATA_KEY } = await import(
    "../src/lib/marketing/audienceResearch/contracts"
  );
  const {
    createAudienceResearchInvoke,
    createMarketingCronCorrelationId,
    isAiRuntimeMarketingCronEnabled,
  } = await import("../src/lib/marketing/cron/marketingCronRuntime");
  const { MARKETING_CRON_HERMES_TIMEOUT_MS } = await import(
    "../src/lib/marketing/cron/marketingPlanSpecialists"
  );
  const { isSeedWrapperAngle } = await import(
    "../src/lib/marketing/audienceResearch/angleQuality"
  );

  const iso = new Date().toISOString();
  const selection = {
    title: "부산 출발 크루즈 추석 탑승 가이드 콘텐츠 관측",
    summary:
      "공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선과 가족 동반 체험을 소개하는 콘텐츠가 관측됨",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: ["부산"],
    topics: ["크루즈", "추석", "탑승"],
    entities: ["MSC 벨리시마"],
    researchBriefId: "rb_busan_cruise_ra1c5",
    agendaCandidateId: "ac_busan_cruise_ra1c5",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta AI Trend Discovery",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/DdEgr-UyM2S/",
        reference: "meta_ai:obs_ra1c5",
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

  const priorExternal = {
    available: true,
    providerId: "openrouter_web_search_reused",
    queryCount: 3,
    resultCount: 4,
    fetchedDocumentCount: 2,
    failedFetchCount: 0,
    totalFetchedBytes: 8400,
    officialSourceCount: 0,
    socialCommunitySourceCount: 2,
    runtimeMs: 1200,
    queries: ["부산 출발 크루즈 처음 탑승 준비", "MSC 벨리시마 부산항 탑승"],
    evidence: [
      {
        evidenceId: "ext_ra1c5_social1",
        url: "https://example.com/community/busan-boarding",
        title: "부산항 첫 크루즈 탑승 후기",
        excerpt:
          "터미널 입구·수하물 라벨·수속 대기 줄이 헷갈린다는 질문이 커뮤니티에서 반복됨",
        sourceClass: "community" as const,
        fromSnippetOnly: false,
        query: "부산 출발 크루즈 처음 탑승 준비",
        purpose: "audience_questions",
      },
      {
        evidenceId: "ext_ra1c5_social2",
        url: "https://example.com/social/family-cruise",
        title: "가족과 크루즈",
        excerpt: "아이·부모님 동반 시 이동 동선과 짐 준비가 가장 큰 불안으로 언급됨",
        sourceClass: "public_social" as const,
        fromSnippetOnly: true,
        query: "MSC 벨리시마 부산항 탑승",
        purpose: "anxieties",
      },
    ],
    observedAudienceQuestions: [
      "부산항 터미널 입구는 어디인가요",
      "수하물은 언제 어디에 부치나요",
      "아이와 함께 타도 준비물이 다른가요",
    ],
    observedCompetitorHooks: ["선내 시설 투어", "객실 브이로그"],
    limitations: ["no_official_sources_in_inspected_sample", "reused_for_ra1c5_synthesis_only"],
  };

  const priorBrief = buildDeterministicAcrb({
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
        generatedAt: iso,
        status: "active",
        editorialIntelligence: editorial,
      } as never,
      editorial,
      historicalMatches: [],
      semanticAvailable: false,
      nearDuplicate: false,
      cooledIdentity: false,
      externalResearch: priorExternal,
    },
  });

  const logicalRunKey = "daily-marketing-production:2026-09-13:ra1c5synth000000001";
  const mprRepo = createInMemoryMarketingProductionRequestRepository();
  await mprRepo.enqueue({
    contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
    requestId: "mpr_ra1c5synth01",
    logicalRunKey,
    slateId: "slate_ra1c5",
    slateItemId: "item_1",
    businessDateKst: "2026-09-13",
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
      title: selection.title,
      summary: selection.summary,
      agendaCandidateId: selection.agendaCandidateId,
      researchBriefId: selection.researchBriefId,
      rationale: [],
      recommendedChannel: "threads",
      recommendedFormats: [],
    },
    errorMessage: null,
    completedCandidateId: null,
    metadata: {
      productId: "prod_ra1c5",
      [PRODUCTION_REQUEST_ACRB_METADATA_KEY]: priorBrief,
    },
  });

  let searchCalls = 0;
  const countingProvider = {
    id: "must_not_search",
    enabled: true,
    async search() {
      searchCalls += 1;
      throw new Error("ra1c5_forbids_new_external_search");
    },
  };

  const useRuntime = isAiRuntimeMarketingCronEnabled();
  const { resolveMarketingCronHermesTimeoutMs } = await import(
    "../src/lib/marketing/cron/hermesSpawnFailure"
  );
  const { MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT } = await import(
    "../src/lib/marketing/cron/marketingPlanSpecialists"
  );
  const { invokeMarketingHermesAgentSync } = await import(
    "../src/lib/marketing/hermesRuntime/syncLauncher"
  );

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

  let llmCalls = 0;
  let llmError: string | null = null;
  const wrappedInvoke = invoke
    ? async (prompt: string) => {
        llmCalls += 1;
        try {
          return await invoke!(prompt);
        } catch (error) {
          llmError = error instanceof Error ? error.message.slice(0, 240) : "invoke_failed";
          throw error;
        }
      }
    : async (prompt: string) => {
        llmCalls += 1;
        // Sparse LLM overlay — exercises empty-section preservation without Hermes.
        void prompt;
        return JSON.stringify({
          audience: {
            primary: [],
            secondary: [],
            motivations: [],
            anxieties: [],
            objections: [],
            decisionTriggers: [],
          },
          searchIntent: {
            primaryIntent: priorBrief.searchIntent.primaryIntent,
            secondaryIntents: [],
            queries: [],
            questions: [],
          },
          marketSignals: {
            observedPatterns: [],
            competitorHooks: [],
            saturatedAngles: [],
            contentGaps: [],
          },
          contentAngles: [
            {
              angleId: "llm_seed_bad",
              angle: "시드 재평가: 가족 해상 휴가",
              hook: "시드 재평가: 가족 해상 휴가",
              audienceTension: "",
              interestScore: 0.9,
              noveltyScore: 0.9,
              evidenceStrength: 0.2,
              channelFit: priorBrief.contentAngles[0]?.channelFit,
              rationale: "",
              supportingFindingRefs: [],
              limitations: [],
            },
          ],
          researchVerdict: "PROCEED_WITH_CAUTION",
          researchStatus: "complete",
          limitations: ["simulated_sparse_llm_for_offline"],
        });
      };

  const result = await ensureAudienceContentResearch({
    handoff,
    logicalRunKey,
    productionRequestRepo: mprRepo,
    forceRegenerate: true,
    skipExternalResearch: true,
    searchProvider: countingProvider,
    invoke: wrappedInvoke,
    loadFullResearchBrief: async () =>
      ({
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
        generatedAt: iso,
        status: "active",
        editorialIntelligence: editorial,
      }) as never,
    listRecentCandidateTitles: async () => [],
  });

  const b = result.brief;
  const recommended = b.contentAngles.find((a) => a.angleId === b.recommendedAngleId);
  const sparse = {
    primary: b.audience.primary.length === 0,
    motivations: b.audience.motivations.length === 0,
    anxieties: b.audience.anxieties.length === 0,
    questions: b.searchIntent.questions.length === 0,
    contentGaps: b.marketSignals.contentGaps.length === 0,
    angles: b.contentAngles.length < 3,
  };

  console.log(
    JSON.stringify(
      {
        RA1C5_SYNTHESIS_RECHECK: true,
        host: hostname(),
        hermes_ai_enabled: useRuntime || Boolean(invoke),
        llm_mode: invoke ? (useRuntime ? "runtime" : "hermes_profile") : "sparse_fixture",
        llm_calls: llmCalls,
        llm_error: llmError,
        external_research_reused: Boolean(result.externalResearchReused),
        new_external_search_calls: searchCalls,
        research_status: b.researchStatus,
        verdict: b.researchVerdict,
        primary_audience: b.audience.primary.map((x) => x.text),
        motivations: b.audience.motivations.map((x) => x.text),
        anxieties: b.audience.anxieties.map((x) => x.text),
        objections: b.audience.objections.map((x) => x.text),
        top_questions: b.searchIntent.questions.slice(0, 6).map((x) => x.text),
        content_gaps: b.marketSignals.contentGaps.map((x) => x.text),
        angles: b.contentAngles.map((a) => a.angle),
        seed_wrapper_angles_present: b.contentAngles.some((a) => isSeedWrapperAngle(a.angle)),
        recommended_angle: recommended?.angle ?? null,
        recommended_tension: recommended?.audienceTension ?? null,
        recommended_rationale: recommended?.rationale ?? null,
        sparse_sections_remaining: sparse,
        limitations: b.limitations.slice(0, 8),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
