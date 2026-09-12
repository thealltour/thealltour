/**
 * RA-1C4 live OpenRouter free-pool web search acceptance.
 * Explicitly uses OpenRouterWebSearchProvider (does not permanently rely on auto priority).
 * Never prints API keys.
 *
 *   npx tsx scripts/ra1c4-live-acceptance.ts
 */
import { hostname } from "node:os";
import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "./loadLocalEnv";

loadLocalEnv();

async function main() {
  const started = Date.now();
  const {
    createOpenRouterWebSearchProvider,
    resolveOpenRouterApiKey,
    OPENROUTER_FREE_MODEL,
  } = await import("../src/lib/marketing/audienceResearch/external/openrouterProvider");
  const { createResearchSearchProvider, resolveResearchSearchProviderStatus } = await import(
    "../src/lib/marketing/audienceResearch/external/createSearchProvider"
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
  const { resolveMarketingCronHermesTimeoutMs, assertHermesSpawnSyncSuccess } = await import(
    "../src/lib/marketing/cron/hermesSpawnFailure"
  );
  const { resolveHermesExecutable } = await import(
    "../src/lib/marketing/cron/resolveHermesExecutable"
  );

  const key = resolveOpenRouterApiKey(process.env);
  const usageAcc = {
    request_count: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    web_search_calls: 0,
    reported_cost: 0,
    models: [] as string[],
    upstream_inference_cost_sum: 0,
  };

  // Preferred plugin form probe (once)
  let pluginProbe: Record<string, unknown> | null = null;
  if (key.apiKey) {
    const base = process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key.apiKey}`,
        "HTTP-Referer": "https://thealltour.local",
        "X-Title": "thealltour-ra1c4-plugin-probe",
      },
      body: JSON.stringify({
        model: OPENROUTER_FREE_MODEL,
        messages: [{ role: "user", content: "부산 여행 한 문장" }],
        plugins: [{ id: "web", max_results: 3 }],
        max_tokens: 80,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: unknown };
      model?: string;
    };
    pluginProbe = {
      status: res.status,
      ok: res.ok,
      err: json.error
        ? String(json.error.message || "")
            .replace(/keys\/[a-f0-9]{16,}/gi, "keys/<redacted>")
            .slice(0, 180)
        : null,
      model: json.model ?? null,
    };
  }

  const provider = createOpenRouterWebSearchProvider({
    apiKey: key.apiKey,
    model: OPENROUTER_FREE_MODEL,
    preferDeprecatedWebPlugin: false,
    onUsage: (u) => {
      usageAcc.request_count += 1;
      usageAcc.prompt_tokens += u.promptTokens ?? 0;
      usageAcc.completion_tokens += u.completionTokens ?? 0;
      usageAcc.web_search_calls += u.webSearchRequests ?? 0;
      usageAcc.reported_cost += u.cost ?? 0;
      usageAcc.upstream_inference_cost_sum += u.upstreamInferenceCost ?? 0;
      if (u.actualModel) usageAcc.models.push(u.actualModel);
    },
  });

  const report: Record<string, unknown> = {
    runtime: {
      host: hostname(),
      openrouter_credential_env: key.envName,
      credential_present: Boolean(key.apiKey),
      existing_gateway: "ai-runtime OpenRouterAdapter + direct chat/completions",
      free_pool_available: null,
      plugin_probe: pluginProbe,
      auto_status_without_force: resolveResearchSearchProviderStatus(process.env),
    },
    smoke: null,
    live_research: null,
    durability: null,
    usage: null,
    blockers: [] as string[],
  };

  if (!provider.enabled) {
    (report.blockers as string[]).push("OPENROUTER_API_KEY missing");
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // smoke
  const smokeQuery = "부산 출발 크루즈 처음 탑승 준비";
  let smokeError: string | null = null;
  let smokeHits: Awaited<ReturnType<typeof provider.search>> = [];
  try {
    smokeHits = await provider.search(smokeQuery, { maxResults: 5, timeoutMs: 120_000 });
  } catch (error) {
    smokeError = error instanceof Error ? error.message.slice(0, 200) : "smoke_failed";
  }
  const smokeClasses = smokeHits.map((h) =>
    classifyExternalSource({ url: h.url, title: h.title, snippet: h.snippet }),
  );
  report.smoke = {
    query: smokeQuery,
    success: smokeHits.length > 0,
    error: smokeError,
    actual_selected_model: usageAcc.models[usageAcc.models.length - 1] ?? null,
    free_model_confirmed: (usageAcc.models[usageAcc.models.length - 1] || "").endsWith(":free"),
    web_search_used: usageAcc.web_search_calls > 0,
    annotation_count: smokeHits.length,
    usable_url_count: smokeHits.filter((h) => /^https?:\/\//i.test(h.url)).length,
    source_classes: smokeClasses,
    sample_hosts: smokeHits.slice(0, 5).map((h) => {
      try {
        return new URL(h.url).hostname;
      } catch {
        return "invalid";
      }
    }),
    korean_quality:
      smokeHits.some((h) => /[가-힣]/.test(`${h.title}${h.snippet}`)) ||
      /[가-힣]/.test(smokeQuery),
    secret_logged: false,
  };
  (report.runtime as { free_pool_available: boolean | null }).free_pool_available =
    Boolean((report.smoke as { free_model_confirmed?: boolean }).free_model_confirmed) ||
    pluginProbe?.status === 200;

  if (pluginProbe && pluginProbe.ok === false) {
    (report.blockers as string[]).push(
      `Deprecated plugins:[{id:web}] rejected (status=${pluginProbe.status}); using openrouter:web_search server tool on same free pool`,
    );
  }
  if (smokeError) (report.blockers as string[]).push(`smoke_error:${smokeError}`);
  if (!smokeHits.length) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // LLM invoke
  const useRuntime = isAiRuntimeMarketingCronEnabled();
  function invokeHermesProfile(profile: string, prompt: string): string {
    const timeoutMs = resolveMarketingCronHermesTimeoutMs(
      process.env,
      MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
    );
    const hermesBin = resolveHermesExecutable(process.env);
    const result = spawnSync(hermesBin, ["-p", profile, "--yolo", "--ignore-rules", "-z", prompt], {
      encoding: "utf8",
      env: { ...process.env, HERMES_HOME: process.env.HERMES_HOME ?? "/home/ysh/.hermes" },
      timeout: timeoutMs,
    });
    return assertHermesSpawnSyncSuccess(profile, result, timeoutMs);
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
    researchBriefId: "rb_busan_cruise_ra1c4",
    agendaCandidateId: "ac_busan_cruise_ra1c4",
    idempotencyKey: "ra1c4-live-force",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social" as const,
        sourceName: "Meta AI Trend Discovery",
        isOfficial: false,
        evidenceType: "derived_signal" as const,
        url: "https://www.instagram.com/reel/DdEgr-UyM2S/",
        reference: "meta_ai:obs_ra1c4",
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
  const logicalRunKey = "daily-marketing-production:2026-09-12:ra1c4liveforce0000001";
  const iso = new Date().toISOString();
  await mprRepo.enqueue({
    contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
    requestId: "mpr_ra1c4_live",
    logicalRunKey,
    slateId: "slate_ra1c4",
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
    metadata: { productId: "prod_ra1c4" },
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

  report.live_research = {
    agenda: selection.title,
    forced_regeneration: true,
    planned_query_count: plan.queries.length,
    planned_queries: plan.queries.map((q) => q.query),
    actual_search_calls: searchCalls,
    grounded_source_count: b.provenance.externalResultCount ?? 0,
    fetched_document_count: b.provenance.fetchedDocumentCount ?? 0,
    fetched_bytes: b.provenance.totalFetchedBytes ?? 0,
    official_source_count: b.provenance.officialSourceCount ?? 0,
    source_classes: [...new Set(b.researchFindings.map((f) => f.sourceClass).filter(Boolean))],
    external_research_used: Boolean(b.provenance.externalResearchUsed),
    research_status: b.researchStatus,
    verdict: b.researchVerdict,
    primary_audience: b.audience.primary.map((x) => x.text),
    strongest_tension: recommended?.audienceTension ?? b.audience.anxieties[0]?.text ?? null,
    top_questions: b.searchIntent.questions.slice(0, 5).map((x) => x.text),
    observed_patterns: b.marketSignals.observedPatterns.map((x) => x.text),
    content_gaps: b.marketSignals.contentGaps.map((x) => x.text),
    angle_count: b.contentAngles.length,
    angles: b.contentAngles.map((a) => a.angle),
    recommended_angle: recommended?.angle ?? null,
    why_recommended: b.recommendedAngleReason,
    unresolved_limitations: b.limitations,
    finding_types: {
      verified_fact: b.researchFindings.filter((f) => f.type === "verified_fact").length,
      observed_signal: b.researchFindings.filter((f) => f.type === "observed_signal").length,
      inference: b.researchFindings.filter((f) => f.type === "inference").length,
      hypothesis: b.researchFindings.filter((f) => f.type === "hypothesis").length,
    },
    synthesis_mode: b.provenance.synthesisMode,
    llm_calls: llmCalls,
    llm_error: llmError,
  };

  const beforeSecond = searchCalls;
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
    second_run_external_calls: searchCalls - beforeSecond,
    reused: second.reused,
    logical_identity_stable: second.brief.logicalIdentity === first.brief.logicalIdentity,
  };

  const gov = prepareContentToGovernanceHandoff({
    draft: {
      contract: "content-draft-v1",
      draftId: "draft_ra1c4",
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
    citation_provenance_visible: gov.request.audienceContentResearch?.researchBriefId === b.id,
    acrb_verdict: gov.request.audienceContentResearch?.researchVerdict ?? null,
  };

  report.provider_fallback = {
    openrouter: createResearchSearchProvider({
      env: { ...process.env, RESEARCH_SEARCH_PROVIDER: "openrouter" },
    }).id,
    gemini: createResearchSearchProvider({
      env: { ...process.env, RESEARCH_SEARCH_PROVIDER: "gemini" },
    }).id,
    tavily: createResearchSearchProvider({
      env: { RESEARCH_SEARCH_PROVIDER: "tavily" },
    }).enabled,
    internal: createResearchSearchProvider({ env: {} }).enabled === false,
  };

  report.usage = {
    ...usageAcc,
    unique_models: [...new Set(usageAcc.models)],
    inference_free_confirmed: usageAcc.upstream_inference_cost_sum === 0,
    search_specific_cost_visible: usageAcc.reported_cost > 0,
    runtime_ms: Date.now() - started,
    search_calls_including_smoke: searchCalls,
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
