/**
 * MQ-4 live acceptance — Hermes/Runtime channel LLM composers for Nha Trang package.
 * Reuses durable ACRB (no external web search). No render / publish.
 *
 *   npx tsx scripts/mq4-production-llm-composer-acceptance.ts
 */
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLocalEnv } from "./loadLocalEnv";

loadLocalEnv();

function sanitize(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

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
  const { channelCountsAsPublishableSuccess } = await import(
    "../src/lib/marketing/publishable/publishableSuccess"
  );
  const {
    createPublishableComposerInvoke,
    createMarketingCronCorrelationId,
    isAiRuntimeMarketingCronEnabled,
  } = await import("../src/lib/marketing/cron/marketingCronRuntime");
  const { MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT } = await import(
    "../src/lib/marketing/cron/marketingPlanSpecialists"
  );
  const { resolveMarketingCronHermesTimeoutMs } = await import(
    "../src/lib/marketing/cron/hermesSpawnFailure"
  );
  const { invokeMarketingHermesAgentSync } = await import(
    "../src/lib/marketing/hermesRuntime/syncLauncher"
  );
  const { createRuntimeExecutorStack } = await import("../src/ai-runtime/integration/runtime-stack");
  const { ensureSharedObservabilityRecorder } = await import(
    "../src/ai-runtime/observability/persistence"
  );
  const { CONTENT_PROPOSITION_CONTRACT } = await import(
    "../src/lib/marketing/content/proposition/contracts"
  );

  let externalSearchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    const url = String(args[0] ?? "");
    const init = args[1];
    const body = typeof init?.body === "string" ? init.body : "";
    if (/openrouter\.ai|tavily|generativelanguage\.googleapis/.test(url)) {
      if (/web_search|"web"|google_search|tavily|server_tool/i.test(body) || /search/i.test(url)) {
        // Count only search-like; allow chat completions for Hermes/OpenRouter inference.
        if (/web_search|tavily|google_search|server_tool/i.test(body)) {
          externalSearchCalls += 1;
        }
      }
    }
    return originalFetch(...args);
  }) as typeof fetch;

  const selection = {
    title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
    summary: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: ["나트랑"],
    topics: ["추석", "패키지", "가족"],
    entities: [],
    researchBriefId: "rb_nhatrang_mq4",
    agendaCandidateId: "ac_nhatrang_mq4",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta AI Trend Discovery",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/mq4/",
        reference: "meta_ai:mq4",
        excerpt: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
        publishedAt: null,
        observedAt: "2026-09-13T00:00:00.000Z",
        credibilityHint: 0.35,
      },
    ],
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
      } as never,
      editorial: {
        hookSignals: ["가격보다 일정"],
        formatSignals: ["checklist"],
        audiencePainPoints: ["가족 일정 조율", "포함사항 불확실"],
        audienceQuestions: ["직항인가요?", "뭐가 포함되나요?"],
        personaHints: ["부산·경남 추석 가족여행 검토자"],
        contentAngles: ["가격보다 일정 먼저"],
      },
      historicalMatches: [],
      semanticAvailable: false,
      nearDuplicate: false,
      cooledIdentity: false,
      externalResearch: null,
    },
  });

  const proposition = {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "부산·경남에서 추석 가족여행을 알아보는 사람",
    audienceProblem: "상품 가격부터 보지만 가족 일정·출발·포함사항이 맞지 않을 수 있음",
    audienceTension: "저렴해 보여 빨리 고르고 싶음 vs 확인 없이 불안",
    whyNow: "추석 연휴 가족 패키지 프로모션이 소셜에서 관측됨",
    contentPromise: "추석 가족여행 상품을 볼 때 가격보다 먼저 확인할 일정·출발·포함사항 기준을 정리한다",
    readerGain: "비교 전에 일정/직항/포함사항부터 확인해야 한다는 기준을 얻는다",
    specificTakeaways: [
      "가족 전원이 가능한 날짜부터 맞춘다",
      "부산 출발·직항 여부를 확인한다",
      "패키지 포함/불포함 항목을 비교한다",
    ],
    proofRequirements: [
      {
        claimArea: "직항 여부",
        requiredProof: "official airline or travel supplier confirmation",
        severity: "must" as const,
      },
      {
        claimArea: "포함사항",
        requiredProof: "current package product inclusions source",
        severity: "must" as const,
      },
    ],
    contentGapUsed: "소셜은 가격/프로모션 훅은 많지만 가족이 무엇부터 확인해야 하는지는 설명하지 않음",
    engagementMechanism: "save_worthy_checklist",
    desiredAudienceAction: "save",
    angle: "가격보다 가족 일정 조율이 먼저다",
    keyMessage: "상품 비교 전에 일정·출발·포함사항부터",
    commercialIntent: "informational",
    propositionStrength: "usable" as const,
    limitations: ["직항·요금은 공식 확인 전 단정 금지"],
  };

  const useRuntime = isAiRuntimeMarketingCronEnabled();
  if (useRuntime) await ensureSharedObservabilityRecorder();
  const timeoutMs = resolveMarketingCronHermesTimeoutMs(
    process.env,
    MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
  );
  function invokeHermesProfile(profile: string, prompt: string): string {
    const hermesTimeout = resolveMarketingCronHermesTimeoutMs(
      process.env,
      MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
    );
    return invokeMarketingHermesAgentSync({
      profileId: profile,
      prompt,
      timeoutMs: hermesTimeout,
    });
  }

  let invoke = createPublishableComposerInvoke({
    useRuntime,
    correlationId: createMarketingCronCorrelationId(),
    executor: useRuntime ? createRuntimeExecutorStack() : undefined,
    completionTimeoutMs: timeoutMs,
    invokeHermesProfile: useRuntime ? undefined : invokeHermesProfile,
  });
  if (!invoke) {
    invoke = createPublishableComposerInvoke({
      useRuntime: false,
      correlationId: createMarketingCronCorrelationId(),
      invokeHermesProfile,
      completionTimeoutMs: timeoutMs,
    });
  }
  if (!invoke) {
    throw new Error("publishable_llm_invoke_unavailable");
  }

  const candidate = {
    contract: "completed-marketing-candidate-v1",
    candidateId: `cmc_mq4_${Date.now()}`,
    businessDateKst: "2026-09-13",
    logicalRunKey: "lr_mq4_live",
    selectedAgenda: handoff.selectedAgenda,
    contentAssignment: handoff.contentAssignment,
    contentPlan: {
      contract: "content-plan-v1",
      assignmentId: handoff.contentAssignment.assignmentId,
      primaryAngle: proposition.angle,
      keyMessage: proposition.keyMessage,
      hook: "추석 가족여행, 상품부터 찾으면 일정부터 꼬일 수 있습니다.",
      outline: ["왜 지금", "먼저 확인할 3가지", "공식 확인이 필요한 것"],
      ctaStrategy: "save checklist",
      targetAudience: proposition.primaryAudience,
      targetChannels: ["threads", "shortform", "naver_band"],
      factsToUse: [],
      factsToAvoid: [],
      evidenceRefs: [],
      recommendedFormats: [{ format: "short_video_concept", score: 0.8 }],
      proposition,
    },
    draft: {
      title: "draft",
      body: "Context\nKey verified facts\nTravel relevance",
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
      routineId: "mq4",
      correlationId: "mq4-live",
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

  const root = mkdtempSync(join(tmpdir(), "mq4-live-"));
  mkdirSync(join(root, "context"), { recursive: true });

  const bundle = await ensurePublishableContent({
    candidate: candidate as never,
    packageRoot: root,
    forceRegenerate: true,
    audienceContentResearchBrief: acrb,
    explicitTargetChannels: ["threads", "shortform", "naver_band"],
    invoke,
    modelProfile: "content-strategist",
    persist: true,
  });

  const export1 = exportMarketingCandidatePackage({
    candidate: candidate as never,
    assetRoot: root,
    audienceContentResearchBrief: acrb,
    publishableBundle: bundle,
  });
  const export2 = exportMarketingCandidatePackage({
    candidate: candidate as never,
    assetRoot: root,
    audienceContentResearchBrief: acrb,
    publishableBundle: bundle,
  });

  const second = await ensurePublishableContent({
    candidate: candidate as never,
    packageRoot: root,
    audienceContentResearchBrief: acrb,
    invoke,
  });

  const cruiseLeak = /크루즈|msc|벨리시마/i;
  const researchScaffold = /관측됐습니다|Meta hook seed|참고해 두세요|Key verified facts|Context\n/i;

  const report = {
    MQ4_PRODUCTION_LLM_COMPOSER_ACCEPTANCE: true,
    agenda: selection.title,
    acrb_reused: true,
    content_proposition_reused: true,
    external_search_calls: externalSearchCalls,
    threads: {
      llm_attempted: Boolean(bundle.threads.provenance.attemptCount),
      llm_success: channelCountsAsPublishableSuccess(bundle.threads),
      composer: bundle.threads.provenance.composer,
      model_profile: bundle.threads.provenance.modelProfile ?? "content-strategist",
      sanitized_preview: sanitize(bundle.threads.body),
      proposition_takeaway_visible: /일정|포함|직항|날짜/.test(bundle.threads.body),
    },
    naver_band: {
      llm_attempted: Boolean(bundle.naver_band?.provenance.attemptCount),
      llm_success: channelCountsAsPublishableSuccess(bundle.naver_band),
      composer: bundle.naver_band?.provenance.composer ?? null,
      model_profile: bundle.naver_band?.provenance.modelProfile ?? "content-strategist",
      sanitized_preview: sanitize(bundle.naver_band?.body ?? ""),
      proposition_takeaway_visible: /일정|포함|직항|날짜/.test(bundle.naver_band?.body ?? ""),
    },
    shortform: {
      llm_attempted: Boolean(bundle.shortform.provenance.attemptCount),
      llm_success: channelCountsAsPublishableSuccess(bundle.shortform),
      composer: bundle.shortform.provenance.composer,
      model_profile: bundle.shortform.provenance.modelProfile ?? "content-strategist",
      sanitized_preview: sanitize(bundle.shortform.body),
      hook_paid_off: (bundle.shortform.narrationSegments?.length ?? 0) >= 2,
      proposition_takeaway_visible: /일정|포함|직항|날짜|기준/.test(bundle.shortform.body),
    },
    internal_research_scaffolding_leaked: researchScaffold.test(
      `${bundle.threads.body}\n${bundle.naver_band?.body ?? ""}\n${bundle.shortform.body}`,
    ),
    meta_hook_seed_leaked: /Meta hook seed/i.test(
      `${bundle.threads.body}\n${bundle.naver_band?.body ?? ""}`,
    ),
    cruise_contamination: cruiseLeak.test(
      `${bundle.threads.body}\n${bundle.naver_band?.body ?? ""}\n${bundle.shortform.body}`,
    ),
    second_read_identical: second.threads.body === bundle.threads.body,
    export_digest_stable: export1.manifest.integrity.digest === export2.manifest.integrity.digest,
  };

  console.log(JSON.stringify(report, null, 2));

  globalThis.fetch = originalFetch;
  rmSync(root, { recursive: true, force: true });

  const ok =
    report.external_search_calls === 0 &&
    report.threads.llm_success &&
    report.naver_band.llm_success &&
    report.shortform.llm_success &&
    report.threads.composer === "llm" &&
    !report.cruise_contamination &&
    !report.internal_research_scaffolding_leaked &&
    report.second_read_identical;

  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
