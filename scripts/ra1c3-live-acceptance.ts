/**
 * RA-1C3 live Gemini grounding acceptance — research only.
 * Never prints API keys / Authorization / x-goog-api-key values.
 *
 *   npx tsx scripts/ra1c3-live-acceptance.ts
 */
import { hostname } from "node:os";
import { loadLocalEnv } from "./loadLocalEnv";

loadLocalEnv();

async function main() {
  const started = Date.now();
  const {
    resolveResearchSearchProviderStatus,
    createResearchSearchProvider,
  } = await import("../src/lib/marketing/audienceResearch/external/createSearchProvider");
  const { resolveGeminiResearchApiKey, DEFAULT_GEMINI_RESEARCH_MODEL } = await import(
    "../src/lib/marketing/audienceResearch/external/geminiProvider"
  );
  const { prepareManagerToContentHandoff } = await import(
    "../src/lib/marketing/content/prepareManagerToContentHandoff"
  );
  const { createInMemoryContentAssignmentStore } = await import(
    "../src/lib/marketing/content/store/contentAssignmentStore"
  );
  const { ensureAudienceContentResearch } = await import(
    "../src/lib/marketing/audienceResearch/ensureAudienceContentResearch"
  );
  const { createInMemoryMarketingProductionRequestRepository } = await import(
    "../src/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository"
  );
  const { MARKETING_PRODUCTION_REQUEST_CONTRACT } = await import(
    "../src/lib/marketing/cron/daily/agendaSlate/productionRequestTypes"
  );
  const { buildResearchQueryPlan } = await import(
    "../src/lib/marketing/audienceResearch/external/queryPlan"
  );
  const { classifyExternalSource } = await import(
    "../src/lib/marketing/audienceResearch/external/sourceClassify"
  );
  const { prepareContentToGovernanceHandoff } = await import(
    "../src/lib/marketing/content/governance/prepareContentToGovernanceHandoff"
  );
  const {
    createAudienceResearchInvoke,
    createMarketingCronCorrelationId,
    isAiRuntimeMarketingCronEnabled,
  } = await import("../src/lib/marketing/cron/marketingCronRuntime");
  const {
    MARKETING_CRON_HERMES_TIMEOUT_MS,
    MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
  } = await import("../src/lib/marketing/cron/marketingPlanSpecialists");
  const { resolveMarketingCronHermesTimeoutMs } = await import(
    "../src/lib/marketing/cron/hermesSpawnFailure"
  );
  const { invokeMarketingHermesAgentSync } = await import(
    "../src/lib/marketing/hermesRuntime/syncLauncher"
  );

  const geminiKey = resolveGeminiResearchApiKey(process.env);
  const status = resolveResearchSearchProviderStatus(process.env);
  const provider = createResearchSearchProvider();
  const model =
    process.env.MARKETING_RESEARCH_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_RESEARCH_MODEL;

  const report: Record<string, unknown> = {
    runtime: {
      host: hostname(),
      google_ai_credential_env: geminiKey.envName,
      credential_present: Boolean(geminiKey.apiKey),
      credential_len: geminiKey.apiKey.length,
      configured_model: model,
      provider_status: status,
      provider_id: provider.id,
      provider_enabled: provider.enabled,
    },
    smoke: null,
    live_research: null,
    llm: null,
    durability: null,
    usage: null,
    blockers: [] as string[],
  };

  // --- smoke ---
  const smokeQuery = "부산 출발 크루즈 처음 탑승 준비";
  let smokeError: string | null = null;
  let smokeHits: Awaited<ReturnType<typeof provider.search>> = [];
  try {
    smokeHits = await provider.search(smokeQuery, { maxResults: 3, timeoutMs: 60_000 });
  } catch (error) {
    smokeError = error instanceof Error ? error.message.slice(0, 160) : "smoke_failed";
  }
  const smokeClasses = smokeHits.map((h) => classifyExternalSource({ url: h.url, title: h.title }));
  report.smoke = {
    query: smokeQuery,
    success: smokeHits.length > 0,
    error: smokeError,
    result_count: smokeHits.length,
    usable_url_count: smokeHits.filter((h) => /^https?:\/\//i.test(h.url)).length,
    sample_hosts: smokeHits.slice(0, 3).map((h) => {
      try {
        return new URL(h.url).hostname;
      } catch {
        return "invalid";
      }
    }),
    source_classes: smokeClasses,
    google_search_used: smokeHits.length > 0 && provider.id === "gemini_google_search",
    secret_logged: false,
  };

  if (smokeError?.includes("rate_limited") || smokeError?.includes("429")) {
    (report.blockers as string[]).push(
      "Gemini Google Search grounding returns RESOURCE_EXHAUSTED/429 on hermes-pi with current Google AI Studio keys; plain generateContent works",
    );
  }
  if (!smokeHits.length && !smokeError) {
    (report.blockers as string[]).push("Gemini returned no grounding chunks for smoke query");
  }

  // --- LLM invoke factory ---
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

  const selection = {
    title: "부산 출발 크루즈 추석 탑승 가이드 콘텐츠 관측",
    summary:
      "공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선과 가족 동반 체험을 소개하는 콘텐츠가 관측됨",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: ["부산"],
    topics: ["크루즈", "추석", "탑승"],
    entities: ["MSC 벨리시마"],
    researchBriefId: "rb_busan_cruise_ra1c3",
    agendaCandidateId: "ac_busan_cruise_ra1c3",
    idempotencyKey: "ra1c3-live-force",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social" as const,
        sourceName: "Meta AI Trend Discovery",
        isOfficial: false,
        evidenceType: "derived_signal" as const,
        url: "https://www.instagram.com/reel/DdEgr-UyM2S/",
        reference: "meta_ai:obs_ra1c3",
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
  const plan = buildResearchQueryPlan({ handoff, editorial, maxQueries: 6 });

  const mprRepo = createInMemoryMarketingProductionRequestRepository();
  const logicalRunKey = "daily-marketing-production:2026-09-12:ra1c3liveforce0000001";
  const iso = new Date().toISOString();
  await mprRepo.enqueue({
    contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
    requestId: "mpr_ra1c3_live",
    logicalRunKey,
    slateId: "slate_ra1c3",
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
    metadata: { productId: "prod_ra1c3" },
  });

  let searchCalls = 0;
  const countingProvider = {
    id: provider.id,
    enabled: provider.enabled,
    async search(query: string, options?: Parameters<typeof provider.search>[1]) {
      searchCalls += 1;
      return provider.search(query, options);
    },
  };

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
    : null;

  const first = await ensureAudienceContentResearch({
    handoff,
    logicalRunKey,
    productionRequestRepo: mprRepo,
    forceRegenerate: true,
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

  const b = first.brief;
  const recommended = b.contentAngles.find((a) => a.angleId === b.recommendedAngleId);
  const overstatements = b.researchFindings
    .filter((f) => f.provenanceNote?.includes("unsupported_performance_prediction") || f.type === "hypothesis")
    .map((f) => f.text.slice(0, 120));

  report.live_research = {
    agenda: selection.title,
    force_regeneration: true,
    planned_query_count: plan.queries.length,
    planned_queries: plan.queries.map((q) => q.query),
    actual_grounding_calls: searchCalls,
    external_research_used: Boolean(b.provenance.externalResearchUsed),
    query_count: b.provenance.queryCount,
    result_count: b.provenance.externalResultCount ?? 0,
    fetched_document_count: b.provenance.fetchedDocumentCount ?? 0,
    fetched_bytes: b.provenance.totalFetchedBytes ?? 0,
    official_source_count: b.provenance.officialSourceCount ?? 0,
    source_classes: [...new Set(b.researchFindings.map((f) => f.sourceClass).filter(Boolean))],
    research_status: b.researchStatus,
    verdict: b.researchVerdict,
    verdict_reasons: b.verdictReasons,
    limitations: b.limitations,
    primary_audience: b.audience.primary.map((x) => x.text),
    strongest_tension: recommended?.audienceTension ?? b.audience.anxieties[0]?.text ?? null,
    top_questions: b.searchIntent.questions.slice(0, 5).map((x) => x.text),
    observed_patterns: b.marketSignals.observedPatterns.map((x) => x.text),
    content_gaps: b.marketSignals.contentGaps.map((x) => x.text),
    angle_count: b.contentAngles.length,
    angles: b.contentAngles.map((a) => a.angle),
    recommended_angle: recommended?.angle ?? null,
    why_recommended: b.recommendedAngleReason,
    evidence_strength: recommended?.evidenceStrength ?? null,
    unresolved_limitations: b.limitations,
    overstatements_downgraded_or_rejected: overstatements.slice(0, 8),
    finding_types: {
      verified_fact: b.researchFindings.filter((f) => f.type === "verified_fact").length,
      observed_signal: b.researchFindings.filter((f) => f.type === "observed_signal").length,
      inference: b.researchFindings.filter((f) => f.type === "inference").length,
      hypothesis: b.researchFindings.filter((f) => f.type === "hypothesis").length,
    },
  };

  report.llm = {
    production_invoke_used: Boolean(wrappedInvoke),
    synthesis_mode: b.provenance.synthesisMode,
    llm_calls: llmCalls,
    llm_error: llmError,
    repair_retry_used: llmCalls >= 2,
    fallback_used: b.provenance.synthesisMode === "deterministic_fallback",
  };

  const searchBeforeSecond = searchCalls;
  const second = await ensureAudienceContentResearch({
    handoff,
    logicalRunKey,
    productionRequestRepo: mprRepo,
    forceRegenerate: false,
    searchProvider: countingProvider,
    invoke: async () => {
      throw new Error("should_not_invoke_on_reuse");
    },
  });
  report.durability = {
    acrb_persisted: first.persisted,
    second_run_force: false,
    second_run_external_calls: searchCalls - searchBeforeSecond,
    reused: second.reused,
    logical_identity_stable: second.brief.logicalIdentity === first.brief.logicalIdentity,
  };

  const gov = prepareContentToGovernanceHandoff({
    draft: {
      contract: "content-draft-v1",
      draftId: "draft_ra1c3",
      assignmentId: handoff.contentAssignment.assignmentId,
      channel: "threads",
      title: selection.title,
      body: "research-only placeholder",
      cta: null,
      evidenceUsed: [],
      claims: [],
      generatedAt: iso,
    } as never,
    assignment: handoff.contentAssignment,
    audienceContentResearchBrief: b,
  });
  report.governance = {
    grounded_findings_visible: gov.request.audienceContentResearch?.researchBriefId === b.id,
    acrb_verdict: gov.request.audienceContentResearch?.researchVerdict ?? null,
  };

  report.usage = {
    external_search_calls: searchCalls,
    query_count: b.provenance.queryCount,
    document_count: b.provenance.fetchedDocumentCount ?? 0,
    synthesis_calls: llmCalls,
    runtime_ms: Date.now() - started,
  };

  report.provider_priority = {
    primary: "gemini_google_search",
    secondary: "tavily",
    degraded_fallback: "ra1b_internal",
    tavily_key_required: false,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      fatal: true,
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
    }),
  );
  process.exit(1);
});
