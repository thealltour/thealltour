import { randomUUID } from "node:crypto";

import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { runDepartmentPipeline, type DepartmentPipelineDeps } from "@/lib/marketing/bot/organization/pipeline";
import type { PerformanceBrief, PerformanceUnavailable } from "@/lib/marketing/bot/organization/handoffs";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import type { ManagerToContentHandoffResult } from "@/lib/marketing/content/types";
import { getDefaultGovernanceReviewStore } from "@/lib/marketing/content/governance";
import type { StructuredGovernanceDecision } from "@/lib/marketing/content/governance/types";
import type { MarketingResearchContext } from "@/lib/marketing/research/manager/types";
import {
  buildLogicalDailyRunKey,
  formatKstBusinessDate,
} from "@/lib/marketing/cron/daily/kstBusinessDate";
import { buildCompletedCandidate } from "@/lib/marketing/cron/daily/mapPipelineResult";
import {
  applyResearchIdentityCooldown,
  collectRecentResearchIdentities,
  DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
} from "@/lib/marketing/cron/daily/researchIdentityCooldown";
import {
  buildManagerAgendaSelectionPrompt,
  parseManagerAgendaSelection,
  resolveResearchPrecondition,
  type ManagerAgendaResolution,
} from "@/lib/marketing/cron/daily/resolveMarketingManagerAgenda";
import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { HumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { bootstrapHumanReviewForCandidate } from "@/lib/marketing/review/bootstrap/bootstrapHumanReview";
import {
  classifyMarketingIncident,
  mapPipelineFailureToReason,
} from "@/lib/marketing/operations/incidentClassification";
import { snapshotFailedRunForIncidentHistory } from "@/lib/marketing/operations/buildIncidentTriage";
import {
  DAILY_MARKETING_RUN_CONTRACT,
  DAILY_MARKETING_ROUTINE_ID,
  type DailyMarketingFailureReason,
  type DailyMarketingPipelineInput,
  type DailyMarketingPipelineResult,
  type DailyMarketingRun,
  type DailyMarketingRunObservability,
} from "@/lib/marketing/cron/daily/types";
import { MARKETING_ATTR, pickMarketingAttributes } from "@/lib/marketing/observability/attributes";
import { truncateSummary } from "@/lib/marketing/observability/privacy";
import type { MarketingTraceRecorder } from "@/lib/marketing/observability/recorder";
import { safeRecorder } from "@/lib/marketing/observability/recorderImpl";
import { resolveMarketingTraceRecorder } from "@/lib/marketing/observability/persistence/factory";
import {
  attributesForEvidencePack,
  attributesForRequirements,
} from "@/lib/marketing/observability/stageAttributes";
import type { MarketingTraceActiveContext } from "@/lib/marketing/observability/withSpan";
import { withMarketingSpan } from "@/lib/marketing/observability/withSpan";

export type DailyMarketingPipelineDeps = DepartmentPipelineDeps & {
  repo?: DailyMarketingRunRepository;
  reviewRepo?: HumanMarketingReviewRepository;
  now?: Date;
  getResearchContext?: () => Promise<MarketingResearchContext>;
  selectManagerAgenda?: (context: MarketingResearchContext) => Promise<ManagerAgendaResolution>;
  invokeManagerProfile?: (prompt: string) => Promise<string>;
  requestPerformance?: () => Promise<PerformanceBrief | PerformanceUnavailable>;
  contentAssignmentStore?: import("@/lib/marketing/content/store/contentAssignmentStore").ContentAssignmentStore;
  governanceReviewStore?: import("@/lib/marketing/content/governance/store/governanceReviewStore").GovernanceReviewStore;
  /** OBS-2 — optional in-memory/noop recorder; default no-op via department pipeline. */
  traceRecorder?: MarketingTraceRecorder | null;
  productionRequestId?: string | null;
  agendaSlateId?: string | null;
  /** RA-1B durability — MarketingProductionRequest.metadata */
  productionRequestRepo?: import("@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository").MarketingProductionRequestRepository | null;
  /** Optional ACRB LLM synthesis; when omitted, deterministic partial research is used. */
  invokeAudienceResearch?: ((prompt: string) => Promise<string> | string) | null;
  /** ED-1 — optional Story Miner LLM invoke; falls back to invokeAudienceResearch when omitted. */
  invokeStoryMiner?: ((prompt: string) => Promise<string> | string) | null;
  forceAudienceResearchRegenerate?: boolean;
  /** MQ-4 — channel-native publishable LLM invoke (Hermes/Runtime). */
  invokePublishableComposer?: ((prompt: string) => Promise<string> | string) | null;
  /**
   * Asset Source Writer invoke (structured JSON). Defaults to invokePublishableComposer
   * when omitted — role contract is prompt-enforced (asset-source-writer).
   */
  invokeAssetSourceWriter?: ((prompt: string) => Promise<string> | string) | null;
};

function buildObservability(run: Partial<DailyMarketingRun>): DailyMarketingRunObservability {
  return {
    runId: run.runId ?? "",
    logicalRunKey: run.logicalRunKey ?? "",
    businessDateKst: run.businessDateKst ?? "",
    correlationId: run.correlationId ?? "",
    researchStatus: run.researchStatus ?? null,
    candidateCount: Number(run.metadata?.candidateCount ?? 0),
    selectedAgendaId: run.selectedAgendaId ?? null,
    assignmentId: run.assignmentId ?? null,
    governanceReviewId: run.governanceReviewId ?? null,
    revisionCount: Number(run.metadata?.revisionCount ?? 0),
    governanceDecision: run.metadata?.governanceDecision ? String(run.metadata.governanceDecision) : null,
    finalCandidateId: run.completedCandidateId ?? null,
    finalStatus: run.metadata?.finalStatus ? String(run.metadata.finalStatus) : null,
    startedAt: run.startedAt ?? new Date().toISOString(),
    completedAt: run.completedAt ?? null,
    failureReason: run.failureReason ?? null,
  };
}

function baseRun(input: {
  logicalRunKey: string;
  businessDateKst: string;
  correlationId: string;
  executionAttempt: number;
  now: Date;
}): DailyMarketingRun {
  return {
    contract: DAILY_MARKETING_RUN_CONTRACT,
    runId: randomUUID(),
    logicalRunKey: input.logicalRunKey,
    businessDateKst: input.businessDateKst,
    routineId: DAILY_MARKETING_ROUTINE_ID,
    correlationId: input.correlationId,
    executionAttempt: input.executionAttempt,
    startedAt: input.now.toISOString(),
    completedAt: null,
    status: "started",
    researchStatus: null,
    selectedAgendaId: null,
    assignmentId: null,
    governanceReviewId: null,
    completedCandidateId: null,
    failureReason: null,
    degraded: false,
    observability: buildObservability({}),
    metadata: {},
  };
}

type PipelineFailureMeta = {
  code: string;
  message: string;
};

async function failRun(
  repo: DailyMarketingRunRepository,
  run: DailyMarketingRun,
  reason: DailyMarketingFailureReason,
  now: Date,
  extras?: {
    pipelineFailure?: PipelineFailureMeta | null;
    revisionCount?: number;
    governanceObserved?: boolean;
  },
): Promise<DailyMarketingPipelineResult> {
  const revisionCount = extras?.revisionCount ?? Number(run.metadata.revisionCount ?? run.observability.revisionCount ?? 0);
  const incident = classifyMarketingIncident({
    failureReason: reason,
    pipelineFailureCode: extras?.pipelineFailure?.code ?? null,
    pipelineFailureMessage: extras?.pipelineFailure?.message ?? null,
    revisionCount,
    governanceReviewId: run.governanceReviewId,
    runtimeGovernanceObserved: extras?.governanceObserved,
  });

  const failed: DailyMarketingRun = {
    ...run,
    status: reason === "MANAGER_DEFERRED" || reason === "RESEARCH_EMPTY" ? "deferred" : "failed",
    failureReason: reason,
    completedAt: now.toISOString(),
    metadata: {
      ...run.metadata,
      revisionCount,
      pipelineFailure: extras?.pipelineFailure ?? run.metadata.pipelineFailure ?? null,
      incident: {
        incidentClass: incident.incidentClass,
        recoveryDisposition: incident.recoveryDisposition,
        concernSummary: incident.concernSummary,
        revisionAttempted: incident.revisionAttempted,
        operatorAction: incident.operatorAction,
      },
    },
    observability: buildObservability({
      ...run,
      failureReason: reason,
      completedAt: now.toISOString(),
      metadata: { ...run.metadata, revisionCount },
    }),
  };
  await repo.saveRun(failed);
  return { idempotent: false, run: failed, candidate: null };
}

export async function runDailyMarketingProductionPipeline(
  input: DailyMarketingPipelineInput,
  deps: DailyMarketingPipelineDeps,
): Promise<DailyMarketingPipelineResult> {
  const now = deps.now ?? new Date();
  const businessDateKst = input.businessDateKst ?? formatKstBusinessDate(now);
  const logicalRunKey =
    input.logicalRunKey?.trim() ||
    buildLogicalDailyRunKey({
      routineId: DAILY_MARKETING_ROUTINE_ID,
      businessDateKst,
    });
  const correlationId = input.correlationId ?? `daily-marketing:${businessDateKst}:${randomUUID().slice(0, 8)}`;
  const repo = deps.repo;
  if (!repo) {
    throw new Error("DailyMarketingRunRepository is required");
  }

  const { createHumanMarketingReviewRepository } = await import(
    "@/lib/marketing/review/repository/createHumanMarketingReviewRepository"
  );
  const reviewRepo =
    deps.reviewRepo ??
    (await createHumanMarketingReviewRepository(
      process.env.VITEST || process.env.NODE_ENV === "test" ? { backend: "memory" } : {},
    ));

  const existingCandidate = await repo.findCandidateByLogicalKey(logicalRunKey);
  const existingRun = await repo.findRunByLogicalKey(logicalRunKey);
  if (existingCandidate && existingRun?.status === "completed") {
    // CG-3: idempotent early-return must still reconcile CG-2 shortform bridge.
    let shortformBridge: Record<string, unknown> = { status: "skipped" };
    try {
      const { reconcileDailyShortformBridgeForCandidate } = await import(
        "@/lib/marketing/assets/shortform/reconcileDailyShortformBridge"
      );
      const bridgeResult = await reconcileDailyShortformBridgeForCandidate({
        candidate: existingCandidate,
        now,
      });
      shortformBridge = {
        status: bridgeResult.outcome,
        shortformIntended: bridgeResult.shortformIntended,
        reason: bridgeResult.reason,
        sceneCount: bridgeResult.sceneCount ?? null,
        sourceResolutionPersisted: bridgeResult.sourceResolutionPersisted ?? false,
        error: bridgeResult.error ?? null,
        holderCandidateId: bridgeResult.holderCandidateId ?? null,
        reconciled: true,
      };
    } catch (error) {
      shortformBridge = {
        status: "brief_failed",
        shortformIntended: false,
        reason: "reconcile_exception",
        error: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
        reconciled: true,
      };
    }

    return {
      idempotent: true,
      run: {
        ...existingRun,
        status: "skipped_idempotent",
        completedCandidateId: existingCandidate.candidateId,
        metadata: {
          ...existingRun.metadata,
          shortformBridge,
        },
        observability: buildObservability({
          ...existingRun,
          completedCandidateId: existingCandidate.candidateId,
          metadata: {
            ...existingRun.metadata,
            finalStatus: existingCandidate.status,
            shortformBridge,
          },
        }),
      },
      candidate: existingCandidate,
    };
  }

  const incidentHistory: Record<string, unknown>[] = [];
  let executionAttempt = input.executionAttempt ?? 1;
  if (existingRun?.status === "failed" && input.recoveryMode) {
    incidentHistory.push(
      ...((Array.isArray(existingRun.metadata.incidentHistory)
        ? existingRun.metadata.incidentHistory
        : []) as Record<string, unknown>[]),
      snapshotFailedRunForIncidentHistory(existingRun),
    );
    if (!input.executionAttempt) {
      executionAttempt = (existingRun.executionAttempt ?? 1) + 1;
    }
  }

  let run = baseRun({
    logicalRunKey,
    businessDateKst,
    correlationId,
    executionAttempt,
    now,
  });
  if (incidentHistory.length > 0) {
    run = {
      ...run,
      metadata: {
        ...run.metadata,
        incidentHistory,
        recoveryFromRunId: existingRun?.runId ?? null,
      },
    };
  }
  run = await repo.saveRun(run);

  let research: MarketingResearchContext;
  try {
    if (deps.getResearchContext) {
      research = await deps.getResearchContext();
    } else {
      const { getMarketingManagerResearchContext } = await import(
        "@/lib/marketing/research/manager/getMarketingManagerResearchContext"
      );
      research = await getMarketingManagerResearchContext({}, { now });
    }
  } catch {
    return failRun(repo, { ...run, researchStatus: "unavailable" }, "RESEARCH_UNAVAILABLE", now);
  }

  const recentCandidates = await repo.listCandidates({ limit: 64 });
  const cooledIdentities = collectRecentResearchIdentities(
    recentCandidates,
    businessDateKst,
    DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
  );
  const cooldownApplied = applyResearchIdentityCooldown(research, cooledIdentities);
  research = cooldownApplied.context;

  run = {
    ...run,
    researchStatus: research.status,
    metadata: {
      ...run.metadata,
      candidateCount: research.agendaCandidates.length,
      researchIdentityCooldown: {
        days: DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
        excludedAgendaCandidateIds: cooldownApplied.excludedAgendaCandidateIds,
        excludedBriefIds: cooldownApplied.excludedBriefIds,
      },
    },
    observability: buildObservability({
      ...run,
      researchStatus: research.status,
      metadata: { candidateCount: research.agendaCandidates.length },
    }),
  };

  const precondition = resolveResearchPrecondition(research);
  if (!precondition.proceed) {
    return failRun(repo, run, precondition.reason, now);
  }
  if (precondition.degraded) {
    run = { ...run, degraded: true };
  }

  let resolution: ManagerAgendaResolution;
  try {
    if (deps.selectManagerAgenda) {
      resolution = await deps.selectManagerAgenda(research);
    } else if (deps.invokeManagerProfile) {
      const raw = await deps.invokeManagerProfile(buildManagerAgendaSelectionPrompt(research));
      resolution = parseManagerAgendaSelection(raw, research);
    } else {
      return failRun(repo, run, "RUNTIME_PROVIDER_FAILED", now);
    }
  } catch {
    return failRun(repo, run, "RUNTIME_PROVIDER_FAILED", now);
  }

  if (resolution.outcome === "defer") {
    return failRun(repo, run, resolution.reason, now);
  }
  if (resolution.outcome === "invalid") {
    return failRun(repo, run, resolution.reason, now);
  }

  let handoff: ManagerToContentHandoffResult;
  let productionTraceContext: MarketingTraceActiveContext | null = null;
  const recorder = safeRecorder(deps.traceRecorder ?? resolveMarketingTraceRecorder());
  try {
    const started = recorder.startTrace({
      traceType: "marketing_production",
      correlation: {
        productionRequestId: deps.productionRequestId ?? null,
        logicalRunKey,
        agendaSlateId: deps.agendaSlateId ?? null,
        correlationId: run.correlationId,
        runId: run.runId,
      },
    });
    const rootSpanId = recorder.startSpan({
      traceId: started.traceId,
      name: "marketing.production",
      kind: "orchestration",
      stage: "production_request",
      actorType: "system",
      attributes: pickMarketingAttributes({
        [MARKETING_ATTR.LOGICAL_RUN_KEY]: logicalRunKey,
        [MARKETING_ATTR.PRODUCTION_REQUEST_ID]: deps.productionRequestId ?? "",
        [MARKETING_ATTR.CHANNEL]: input.channel,
      }),
    }).spanId;
    productionTraceContext = { recorder, traceId: started.traceId, rootSpanId };

    handoff = await withMarketingSpan(
      recorder,
      {
        traceId: started.traceId,
        parentSpanId: rootSpanId,
        name: "marketing.manager",
        kind: "agent",
        stage: "marketing_manager",
        actorType: "hermes_bot",
        actorId: "marketing-manager",
      },
      async () =>
        prepareManagerToContentHandoff(
          {
            ...resolution.input,
            channel: input.channel,
            researchCandidate: resolution.researchCandidate,
            researchBrief: resolution.researchBrief,
            idempotencyKey: logicalRunKey,
          },
          { store: deps.contentAssignmentStore, now },
        ),
      (result) => ({
        status: "ok" as const,
        attributes: pickMarketingAttributes({
          [MARKETING_ATTR.ASSIGNMENT_ID]: result.contentAssignment.assignmentId,
          [MARKETING_ATTR.SELECTED_AGENDA_ID]: result.selectedAgenda.id,
          [MARKETING_ATTR.ASSIGNMENT_SUMMARY]: truncateSummary(result.selectedAgenda.title),
          [MARKETING_ATTR.REQ_DESTINATION_REQUIRED]:
            result.deliverableRequirements?.requiredDestinations ?? [],
        }),
      }),
    );

    await withMarketingSpan(
      recorder,
      {
        traceId: started.traceId,
        parentSpanId: rootSpanId,
        name: "marketing.deliverable_requirements",
        kind: "deterministic",
        stage: "deliverable_requirements",
        actorType: "typescript_staff",
        actorId: "deliverable_requirements",
      },
      async () => undefined,
      () => ({
        status: handoff.deliverableRequirements ? ("ok" as const) : ("skipped" as const),
        attributes: attributesForRequirements(handoff.deliverableRequirements),
      }),
    );

    await withMarketingSpan(
      recorder,
      {
        traceId: started.traceId,
        parentSpanId: rootSpanId,
        name: "marketing.evidence_pack",
        kind: "deterministic",
        stage: "evidence_pack",
        actorType: "typescript_staff",
        actorId: "evidence_pack",
      },
      async () => undefined,
      () => ({
        status: handoff.evidencePack ? ("ok" as const) : ("skipped" as const),
        attributes: attributesForEvidencePack(handoff.evidencePack),
      }),
    );
  } catch {
    if (productionTraceContext) {
      try {
        productionTraceContext.recorder.endSpan({
          traceId: productionTraceContext.traceId,
          spanId: productionTraceContext.rootSpanId,
          status: "error",
          otelStatusCode: "ERROR",
        });
        productionTraceContext.recorder.endTrace({
          traceId: productionTraceContext.traceId,
          status: "failed",
        });
      } catch {
        /* ignore */
      }
    }
    return failRun(repo, run, "ASSIGNMENT_FAILED", now);
  }

  run = {
    ...run,
    selectedAgendaId: handoff.selectedAgenda.id,
    assignmentId: handoff.contentAssignment.assignmentId,
    observability: buildObservability({
      ...run,
      selectedAgendaId: handoff.selectedAgenda.id,
      assignmentId: handoff.contentAssignment.assignmentId,
    }),
  };

  // RA-1B — Audience & Content Research (durable on production request before CS).
  let audienceContentResearchBrief: import("@/lib/marketing/audienceResearch/contracts").AudienceContentResearchBrief | null =
    null;
  const productionRequestRepo = deps.productionRequestRepo ?? null;

  // ED-1 — Editorial Story/Point Miner (durable CandidateSet before human selection / RA-1).
  let storyPointCandidateSet: import("@/lib/marketing/storyPoint/contracts").DurableStoryPointCandidateSet | null =
    null;
  let humanStorySelectionActive = false;
  let activeHumanStorySelection: import("@/lib/marketing/storyPoint/humanStorySelection").HumanStorySelection | null =
    null;
  if (productionRequestRepo) {
    try {
      const { ensureStoryPointCandidateSet } = await import(
        "@/lib/marketing/storyPoint/ensureStoryPointCandidateSet"
      );
      const {
        applyHumanSelectionToCandidateSet,
        PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
        PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY,
        readHumanStorySelection,
        selectionIsActive,
      } = await import("@/lib/marketing/storyPoint/humanStorySelection");
      const storyStartedAt = Date.now();
      const recentCandidates = await repo.listCandidates({ limit: 30 }).catch(() => []);
      const runStoryMine = async () => {
        const mined = await ensureStoryPointCandidateSet({
          handoff,
          logicalRunKey,
          productionRequestRepo,
          invoke: deps.invokeStoryMiner ?? deps.invokeAudienceResearch ?? null,
          forceRemine: Boolean(deps.forceAudienceResearchRegenerate),
          now,
          recentTitles: recentCandidates
            .map((c: { selectedAgenda?: { title?: string }; title?: string }) =>
              c.selectedAgenda?.title ?? c.title ?? "",
            )
            .filter(Boolean),
          recentStorySummaries: [],
          lightResearchHints: [],
        });
        const productionRequest = await productionRequestRepo
          .findByLogicalKey(logicalRunKey)
          .catch(() => null);
        const humanSelection = readHumanStorySelection(productionRequest);
        const humanApplied =
          mined.candidateSet.outcome === "pass" && selectionIsActive(humanSelection)
            ? applyHumanSelectionToCandidateSet({
                candidateSet: mined.candidateSet,
                selection: humanSelection!,
              })
            : null;
        const selectionStatus =
          mined.candidateSet.outcome !== "pass"
            ? "n/a"
            : humanApplied
              ? "human_selected"
              : selectionIsActive(humanSelection)
                ? "stale_or_invalid"
                : "awaiting_human_selection";
        return {
          ...mined,
          effectiveCandidateSet: humanApplied ?? mined.candidateSet,
          humanSelection,
          humanApplied,
          selectionStatus,
        };
      };

      const storyResult =
        productionTraceContext
          ? await withMarketingSpan(
              productionTraceContext.recorder,
              {
                traceId: productionTraceContext.traceId,
                parentSpanId: productionTraceContext.rootSpanId,
                name: "marketing.story_point",
                kind: "deterministic",
                stage: "story_point",
                actorType: "typescript_staff",
                actorId: "story-point-miner",
              },
              runStoryMine,
              (result) => ({
                status: "ok" as const,
                attributes: pickMarketingAttributes({
                  [MARKETING_ATTR.STORY_POINT_OUTCOME]: result.candidateSet.outcome,
                  [MARKETING_ATTR.STORY_POINT_SKIP_REASON]:
                    result.candidateSet.skipReason ?? "",
                  [MARKETING_ATTR.STORY_POINT_ATTEMPTS]: result.candidateSet.attempts,
                  [MARKETING_ATTR.STORY_POINT_PASS_COUNT]:
                    result.candidateSet.diagnostics.passCount,
                  [MARKETING_ATTR.STORY_POINT_CANDIDATE_COUNT]:
                    result.candidateSet.diagnostics.candidateCount,
                  [MARKETING_ATTR.STORY_POINT_REUSED]: result.reused,
                  [MARKETING_ATTR.STORY_POINT_PRIMARY_ID]:
                    result.effectiveCandidateSet.primaryStoryPointId ?? "",
                  [MARKETING_ATTR.STORY_POINT_AWAITING_SELECTION]:
                    result.selectionStatus === "awaiting_human_selection",
                  [MARKETING_ATTR.STORY_POINT_SELECTION_STATUS]: result.selectionStatus,
                  [MARKETING_ATTR.STORY_POINT_SELECTED_BY]: result.humanApplied
                    ? "human"
                    : "",
                  [MARKETING_ATTR.STORY_POINT_HUMAN_SELECTED_ID]:
                    result.humanApplied?.primaryStoryPointId ?? "",
                }),
              }),
            )
          : await runStoryMine();
      storyPointCandidateSet = storyResult.effectiveCandidateSet;
      humanStorySelectionActive = Boolean(storyResult.humanApplied);
      activeHumanStorySelection = storyResult.humanSelection;

      run = {
        ...run,
        metadata: {
          ...run.metadata,
          storyPointCandidateSet: {
            outcome: storyResult.candidateSet.outcome,
            skipReason: storyResult.candidateSet.skipReason,
            reused: storyResult.reused,
            attempts: storyResult.candidateSet.attempts,
            llmCallCount: storyResult.candidateSet.llmCallCount,
            candidateCount: storyResult.candidateSet.diagnostics.candidateCount,
            passCount: storyResult.candidateSet.diagnostics.passCount,
            mechanisms: storyResult.candidateSet.diagnostics.mechanisms,
            selectedPrimaryTitle: storyPointCandidateSet.diagnostics.selectedPrimaryTitle,
            primaryStoryPointId: storyPointCandidateSet.primaryStoryPointId,
            primaryStoryPointHash: storyPointCandidateSet.primaryStoryPointHash,
            humanSelected: humanStorySelectionActive,
            awaitingHumanSelection:
              storyPointCandidateSet.outcome === "pass" && !humanStorySelectionActive,
            selectionStatus: storyResult.selectionStatus,
            selectedBy: humanStorySelectionActive ? "human" : null,
            runtimeMs: Date.now() - storyStartedAt,
          },
        },
      };

      if (storyResult.candidateSet.outcome === "skip") {
        const skippedRun: DailyMarketingRun = {
          ...run,
          status: "deferred",
          completedAt: now.toISOString(),
          failureReason: "STORY_POINT_SKIPPED",
          metadata: {
            ...run.metadata,
            productionOutcome: "story_point_skip",
            storyPointSkipReason: storyResult.candidateSet.skipReason,
            storyPointCandidateSetFull: storyResult.candidateSet,
          },
          observability: buildObservability({
            ...run,
            completedAt: now.toISOString(),
            failureReason: "STORY_POINT_SKIPPED",
          }),
        };
        await repo.saveRun(skippedRun);
        if (productionTraceContext) {
          try {
            productionTraceContext.recorder.endSpan({
              traceId: productionTraceContext.traceId,
              spanId: productionTraceContext.rootSpanId,
              status: "ok",
              otelStatusCode: "OK",
            });
            productionTraceContext.recorder.endTrace({
              traceId: productionTraceContext.traceId,
              status: "partial",
            });
          } catch {
            /* ignore */
          }
        }
        return {
          idempotent: false,
          run: skippedRun,
          candidate: null,
          audienceContentResearchBrief: null,
          storyPointCandidateSet: storyResult.candidateSet,
        };
      }

      // ED-LIVE — pause for human Story selection before RA-1 / CS / composers.
      if (storyPointCandidateSet.outcome === "pass" && !humanStorySelectionActive) {
        const pausedRun: DailyMarketingRun = {
          ...run,
          status: "deferred",
          completedAt: now.toISOString(),
          failureReason: null,
          metadata: {
            ...run.metadata,
            productionOutcome: PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
            storyPointCandidateSetFull: storyPointCandidateSet,
            [PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY]: activeHumanStorySelection,
          },
          observability: buildObservability({
            ...run,
            completedAt: now.toISOString(),
            failureReason: null,
          }),
        };
        await repo.saveRun(pausedRun);
        if (productionTraceContext) {
          try {
            productionTraceContext.recorder.endSpan({
              traceId: productionTraceContext.traceId,
              spanId: productionTraceContext.rootSpanId,
              status: "ok",
              otelStatusCode: "OK",
            });
            productionTraceContext.recorder.endTrace({
              traceId: productionTraceContext.traceId,
              status: "partial",
            });
          } catch {
            /* ignore */
          }
        }
        return {
          idempotent: false,
          run: pausedRun,
          candidate: null,
          audienceContentResearchBrief: null,
          storyPointCandidateSet,
        };
      }
    } catch (error) {
      const skippedRun: DailyMarketingRun = {
        ...run,
        status: "deferred",
        completedAt: now.toISOString(),
        failureReason: "STORY_POINT_SKIPPED",
        metadata: {
          ...run.metadata,
          productionOutcome: "story_point_skip",
          storyPointSkipReason: "story_point_generation_failed",
          storyPointError:
            error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
        },
        observability: buildObservability({
          ...run,
          completedAt: now.toISOString(),
          failureReason: "STORY_POINT_SKIPPED",
        }),
      };
      await repo.saveRun(skippedRun);
      return {
        idempotent: false,
        run: skippedRun,
        candidate: null,
        audienceContentResearchBrief: null,
        storyPointCandidateSet: null,
      };
    }
  }

  if (productionRequestRepo) {
    try {
      const { ensureAudienceContentResearch } = await import(
        "@/lib/marketing/audienceResearch/ensureAudienceContentResearch"
      );
      const { createResearchRepository } = await import(
        "@/lib/marketing/research/repository/createResearchRepository"
      );
      const acrbStartedAt = Date.now();
      const researchRepo = await createResearchRepository().catch(() => null);
      const recentCandidates = await repo.listCandidates({ limit: 30 }).catch(() => []);
      const listRecentTitles = async () =>
        recentCandidates.map((c) => ({
          id: c.candidateId,
          title: c.selectedAgenda.title,
        }));
      const acrbCommon = {
        handoff,
        logicalRunKey,
        productionRequestRepo,
        compactBrief: resolution.researchBrief,
        compactCandidate: resolution.researchCandidate,
        forceRegenerate: Boolean(deps.forceAudienceResearchRegenerate),
        invoke: deps.invokeAudienceResearch ?? null,
        now,
        loadFullResearchBrief: researchRepo ? (id: string) => researchRepo.findBriefById(id) : undefined,
        listRecentCandidateTitles: listRecentTitles,
        cooledIdentity: false,
        semanticAvailable: true,
      };
      let storyResearchCanProceed: boolean | undefined;
      let storyResearchSkipReason: string | null = null;
      let storyResearchAlternateUsed = false;
      let storyResearchExternalSearchCount = 0;
      const runEnsure = async () => {
        if (storyPointCandidateSet?.outcome === "pass" && storyPointCandidateSet.primaryStoryPointId) {
          const { ensureStoryTargetedResearch } = await import(
            "@/lib/marketing/storyPoint/ensureStoryTargetedResearch"
          );
          const targeted = await ensureStoryTargetedResearch({
            ...acrbCommon,
            candidateSet: storyPointCandidateSet,
          });
          storyResearchCanProceed = targeted.storyResearchCanProceed;
          storyResearchSkipReason = targeted.storyResearchSkipReason;
          storyResearchAlternateUsed = targeted.alternateFallbackUsed;
          storyResearchExternalSearchCount = targeted.externalSearchRequestCount;
          if (!targeted.brief) {
            throw new Error("story_targeted_research_missing_brief");
          }
          return {
            brief: targeted.brief,
            reused: targeted.reused,
            persisted: targeted.persisted,
            externalResearchReused: false,
          };
        }
        return ensureAudienceContentResearch(acrbCommon);
      };

      const acrbResult =
        productionTraceContext
          ? await withMarketingSpan(
              productionTraceContext.recorder,
              {
                traceId: productionTraceContext.traceId,
                parentSpanId: productionTraceContext.rootSpanId,
                name: "marketing.audience_content_research",
                kind: "deterministic",
                stage: "audience_content_research",
                actorType: "typescript_staff",
                actorId: "audience-content-research",
              },
              runEnsure,
              (result) => ({
                status: "ok" as const,
                attributes: pickMarketingAttributes({
                  [MARKETING_ATTR.RESEARCH_BRIEF_ID]: result.brief.id,
                  [MARKETING_ATTR.SELECTED_AGENDA_ID]: result.brief.selectedAgendaId,
                  [MARKETING_ATTR.ASSIGNMENT_ID]: result.brief.assignmentId,
                  [MARKETING_ATTR.ACRB_VERDICT]: result.brief.researchVerdict,
                  [MARKETING_ATTR.ACRB_STATUS]: result.brief.researchStatus,
                  [MARKETING_ATTR.ACRB_ANGLE_COUNT]: result.brief.contentAngles.length,
                  [MARKETING_ATTR.ACRB_REUSED]: result.reused,
                  [MARKETING_ATTR.ACRB_EXTERNAL_USED]: Boolean(
                    result.brief.provenance.externalResearchUsed,
                  ),
                  [MARKETING_ATTR.ACRB_SEARCH_PROVIDER]:
                    result.brief.provenance.searchProvider ?? "none",
                  [MARKETING_ATTR.ACRB_QUERY_COUNT]: result.brief.provenance.queryCount,
                  [MARKETING_ATTR.ACRB_RESULT_COUNT]:
                    result.brief.provenance.externalResultCount ?? 0,
                  [MARKETING_ATTR.ACRB_FETCHED_DOCUMENT_COUNT]:
                    result.brief.provenance.fetchedDocumentCount ?? 0,
                  [MARKETING_ATTR.ACRB_OFFICIAL_SOURCE_COUNT]:
                    result.brief.provenance.officialSourceCount ?? 0,
                  [MARKETING_ATTR.ACRB_SOCIAL_SOURCE_COUNT]:
                    result.brief.provenance.socialCommunitySourceCount ?? 0,
                  [MARKETING_ATTR.ACRB_FETCHED_BYTES]:
                    result.brief.provenance.totalFetchedBytes ?? 0,
                  [MARKETING_ATTR.ACRB_EXTERNAL_RUNTIME_MS]:
                    result.brief.provenance.externalResearchRuntimeMs ?? 0,
                  [MARKETING_ATTR.ACRB_SYNTHESIS_MODE]: result.brief.provenance.synthesisMode,
                  [MARKETING_ATTR.RESULT_SUMMARY]: truncateSummary(
                    `${result.brief.researchVerdict}:${result.brief.recommendedAngleId ?? "none"}`,
                  ),
                }),
              }),
            )
          : await runEnsure();
      audienceContentResearchBrief = acrbResult.brief;
      run = {
        ...run,
        metadata: {
          ...run.metadata,
          audienceContentResearch: {
            id: acrbResult.brief.id,
            verdict: acrbResult.brief.researchVerdict,
            status: acrbResult.brief.researchStatus,
            reused: acrbResult.reused,
            runtimeMs: Date.now() - acrbStartedAt,
            angleCount: acrbResult.brief.contentAngles.length,
            recommendedAngleId: acrbResult.brief.recommendedAngleId,
            externalResearchUsed: Boolean(acrbResult.brief.provenance.externalResearchUsed),
            searchProvider: acrbResult.brief.provenance.searchProvider ?? null,
            queryCount: acrbResult.brief.provenance.queryCount,
            resultCount: acrbResult.brief.provenance.externalResultCount ?? 0,
            fetchedDocumentCount: acrbResult.brief.provenance.fetchedDocumentCount ?? 0,
            officialSourceCount: acrbResult.brief.provenance.officialSourceCount ?? 0,
            socialCommunitySourceCount:
              acrbResult.brief.provenance.socialCommunitySourceCount ?? 0,
            totalFetchedBytes: acrbResult.brief.provenance.totalFetchedBytes ?? 0,
            externalResearchRuntimeMs:
              acrbResult.brief.provenance.externalResearchRuntimeMs ?? 0,
            synthesisMode: acrbResult.brief.provenance.synthesisMode,
          },
          ...(storyResearchCanProceed !== undefined
            ? {
                storyResearch: {
                  storyPointId: acrbResult.brief.storyPointRef?.storyPointId ?? null,
                  storyPointHash: acrbResult.brief.storyPointRef?.storyPointHash ?? null,
                  storySupportVerdict: acrbResult.brief.storySupportVerdict ?? null,
                  supportedClaimBoundary: acrbResult.brief.supportedClaimBoundary ?? null,
                  alternateFallbackUsed: storyResearchAlternateUsed,
                  storyResearchCanProceed,
                  storyResearchSkipReason,
                  externalSearchRequestCount: storyResearchExternalSearchCount,
                },
              }
            : {}),
        },
      };

      const storyResearchBlocked =
        storyResearchCanProceed === false && storyPointCandidateSet?.outcome === "pass";
      if (acrbResult.brief.researchVerdict === "SKIP" || storyResearchBlocked) {
        // Human-selected Story REFUTED/INSUFFICIENT → return to selection (no auto-alternate).
        if (storyResearchBlocked && humanStorySelectionActive && activeHumanStorySelection) {
          const {
            PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
            PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY,
            markStoryResearchRejected,
          } = await import("@/lib/marketing/storyPoint/humanStorySelection");
          const rejectReason =
            storyResearchSkipReason ??
            acrbResult.brief.storySupportVerdict ??
            "story_research_rejected";
          const cleared = markStoryResearchRejected({
            selection: activeHumanStorySelection,
            reason: String(rejectReason),
          });
          try {
            const existing = await productionRequestRepo.findByLogicalKey(logicalRunKey);
            if (existing) {
              await productionRequestRepo.update({
                ...existing,
                updatedAt: now.toISOString(),
                metadata: {
                  ...existing.metadata,
                  [PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY]: cleared,
                  productionOutcome: PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
                  lastStoryResearchRejectReason: cleared.lastResearchRejectReason,
                },
              });
            }
          } catch {
            /* best-effort; queue also persists outcome */
          }
          const awaitingRun: DailyMarketingRun = {
            ...run,
            status: "deferred",
            completedAt: now.toISOString(),
            failureReason: null,
            metadata: {
              ...run.metadata,
              productionOutcome: PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
              storyResearchSkipReason,
              lastStoryResearchRejectReason: cleared.lastResearchRejectReason,
              [PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY]: cleared,
              audienceContentResearchBrief: acrbResult.brief,
              storyPointCandidateSetFull: storyPointCandidateSet,
            },
            observability: buildObservability({
              ...run,
              completedAt: now.toISOString(),
              failureReason: null,
            }),
          };
          await repo.saveRun(awaitingRun);
          if (productionTraceContext) {
            try {
              productionTraceContext.recorder.endSpan({
                traceId: productionTraceContext.traceId,
                spanId: productionTraceContext.rootSpanId,
                status: "ok",
                otelStatusCode: "OK",
              });
              productionTraceContext.recorder.endTrace({
                traceId: productionTraceContext.traceId,
                status: "partial",
              });
            } catch {
              /* ignore */
            }
          }
          return {
            idempotent: false,
            run: awaitingRun,
            candidate: null,
            audienceContentResearchBrief: acrbResult.brief,
            storyPointCandidateSet,
          };
        }

        const skippedRun: DailyMarketingRun = {
          ...run,
          status: "deferred",
          completedAt: now.toISOString(),
          failureReason: storyResearchBlocked
            ? "STORY_POINT_SKIPPED"
            : "AUDIENCE_CONTENT_RESEARCH_SKIPPED",
          metadata: {
            ...run.metadata,
            productionOutcome: storyResearchBlocked
              ? "story_research_skip"
              : "audience_content_research_skip",
            storyResearchSkipReason: storyResearchBlocked ? storyResearchSkipReason : null,
            audienceContentResearchBrief: acrbResult.brief,
          },
          observability: buildObservability({
            ...run,
            completedAt: now.toISOString(),
            failureReason: storyResearchBlocked
              ? "STORY_POINT_SKIPPED"
              : "AUDIENCE_CONTENT_RESEARCH_SKIPPED",
          }),
        };
        await repo.saveRun(skippedRun);
        if (productionTraceContext) {
          try {
            productionTraceContext.recorder.endSpan({
              traceId: productionTraceContext.traceId,
              spanId: productionTraceContext.rootSpanId,
              status: "ok",
              otelStatusCode: "OK",
            });
            productionTraceContext.recorder.endTrace({
              traceId: productionTraceContext.traceId,
              status: "partial",
              correlation: {
                productionRequestId: deps.productionRequestId ?? null,
                logicalRunKey,
                agendaSlateId: deps.agendaSlateId ?? null,
                assignmentId: handoff.contentAssignment.assignmentId,
                runId: skippedRun.runId,
                correlationId: skippedRun.correlationId,
              },
            });
          } catch {
            /* ignore */
          }
        }
        return {
          idempotent: false,
          run: skippedRun,
          candidate: null,
          audienceContentResearchBrief: acrbResult.brief,
        };
      }
    } catch (error) {
      // Research failure must not invent content — degrade to caution path only if we can continue without ACRB.
      // Prefer fail-soft: continue CS with null ACRB only when durability store missing mid-flight;
      // if ensure threw after assignment, keep going without brief but mark limitation in metadata.
      run = {
        ...run,
        metadata: {
          ...run.metadata,
          audienceContentResearchError:
            error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
        },
      };
    }
  }

  const goal =
    input.goal ??
    `Daily marketing candidate for ${handoff.selectedAgenda.title} (publish forbidden)`;

  const pipeline = await runDepartmentPipeline(
    {
      productId: input.productId,
      channel: input.channel,
      goal,
      constraints: [
        "do not invent product facts",
        "do not publish",
        "do not create cron jobs",
        input.performanceNote ?? "daily marketing pipeline",
      ],
      memoryReferences: input.memoryReferences ?? [],
      selectedAgenda: handoff.selectedAgenda,
      contentAssignment: handoff.contentAssignment,
      contentAssignmentId: handoff.contentAssignment.assignmentId,
      contentPlanScaffold: handoff.contentPlanScaffold,
      deliverableRequirements: handoff.deliverableRequirements,
      evidencePack: handoff.evidencePack,
      audienceContentResearchBrief,
      brief: audienceContentResearchBrief,
      authoritativeStoryPoint:
        storyPointCandidateSet?.outcome === "pass" && storyPointCandidateSet.primaryStoryPointId
          ? (storyPointCandidateSet.candidates.find(
              (c) => c.pointId === storyPointCandidateSet.primaryStoryPointId,
            ) ?? null)
          : null,
    },
    {
      ...deps,
      governanceReviewStore: deps.governanceReviewStore ?? getDefaultGovernanceReviewStore(),
      requestPerformance: deps.requestPerformance,
      trace: productionTraceContext
        ? {
            recorder: productionTraceContext.recorder,
            context: productionTraceContext,
            correlation: {
              productionRequestId: deps.productionRequestId ?? null,
              logicalRunKey,
              agendaSlateId: deps.agendaSlateId ?? null,
              assignmentId: handoff.contentAssignment.assignmentId,
              runId: run.runId,
              correlationId: run.correlationId,
            },
            emitHandoffObservationSpans: false,
          }
        : deps.traceRecorder
          ? { recorder: deps.traceRecorder, emitHandoffObservationSpans: true }
          : null,
    },
  );

  const productionTraceStatus =
    pipeline.failure || pipeline.status === "handoff_failed"
      ? ("failed" as const)
      : pipeline.status === "revision_required"
        ? ("partial" as const)
        : ("completed" as const);
  const productionTraceCorrelationBase = {
    productionRequestId: deps.productionRequestId ?? null,
    logicalRunKey,
    agendaSlateId: deps.agendaSlateId ?? null,
    agendaCandidateId: handoff.selectedAgenda.id,
    assignmentId: handoff.contentAssignment.assignmentId,
    runId: run.runId,
    correlationId: run.correlationId,
  };

  const closeProductionTrace = (
    correlation?: {
      candidateId?: string | null;
      reviewId?: string | null;
      governanceReviewId?: string | null;
    },
    statusOverride?: "completed" | "failed" | "partial",
  ) => {
    if (!productionTraceContext) return;
    const status = statusOverride ?? productionTraceStatus;
    try {
      productionTraceContext.recorder.endSpan({
        traceId: productionTraceContext.traceId,
        spanId: productionTraceContext.rootSpanId,
        status: status === "failed" ? "error" : "ok",
        otelStatusCode: status === "failed" ? "ERROR" : "OK",
      });
      productionTraceContext.recorder.endTrace({
        traceId: productionTraceContext.traceId,
        status,
        correlation: {
          ...productionTraceCorrelationBase,
          ...correlation,
        },
      });
    } catch {
      /* never fail production on trace close */
    }
  };

  if (productionTraceStatus === "failed") {
    closeProductionTrace();
  }

  const governanceEnvelopes = pipeline.envelopes.filter(
    (envelope) => envelope.sourceAgent === "governance-auditor" && envelope.targetAgent === "marketing-manager",
  );
  const lastStructuredGovernance = (governanceEnvelopes[governanceEnvelopes.length - 1]?.payload ??
    null) as StructuredGovernanceDecision | null;
  if (lastStructuredGovernance?.reviewId) {
    run.governanceReviewId = lastStructuredGovernance.reviewId;
  }

  if (pipeline.failure?.code === "content_unavailable") {
    if (productionTraceStatus !== "failed") closeProductionTrace();
    return failRun(repo, run, "CONTENT_STRATEGIST_FAILED", now, {
      pipelineFailure: pipeline.failure,
    });
  }
  if (pipeline.failure?.code === "governance_unavailable" || pipeline.failure?.code === "handoff_failed") {
    if (productionTraceStatus !== "failed") closeProductionTrace();
    const reason = mapPipelineFailureToReason({
      pipelineFailureCode: pipeline.failure.code,
      pipelineFailureMessage: pipeline.failure.message,
    });
    const governanceObserved = governanceEnvelopes.length > 0;
    return failRun(repo, run, reason, now, {
      pipelineFailure: pipeline.failure,
      revisionCount: pipeline.revisionRounds,
      governanceObserved,
    });
  }
  if (!pipeline.draft) {
    if (productionTraceStatus !== "failed") closeProductionTrace();
    return failRun(repo, run, "CONTENT_STRATEGIST_FAILED", now);
  }

  const candidate = buildCompletedCandidate({
    run: {
      ...run,
      metadata: {
        ...run.metadata,
        revisionCount: pipeline.revisionRounds,
        governanceDecision: lastStructuredGovernance?.decision ?? pipeline.governance?.decision ?? null,
        finalStatus: null,
      },
    },
    handoff,
    pipeline,
    governance: lastStructuredGovernance,
    now,
    audienceContentResearchBrief,
  });

  if (jsonContainsForbiddenBotLeak(candidate)) {
    closeProductionTrace(undefined, "failed");
    return failRun(repo, run, "PERSISTENCE_FAILED", now);
  }

  let savedCandidate;
  try {
    savedCandidate = await repo.saveCandidate(candidate);
  } catch {
    closeProductionTrace(undefined, "failed");
    return failRun(repo, run, "PERSISTENCE_FAILED", now);
  }

  let humanReviewBootstrap: Record<string, unknown> = { status: "skipped", candidateId: savedCandidate.candidateId };
  const bootstrapResult = await bootstrapHumanReviewForCandidate(savedCandidate, {
    reviewRepo,
    now: () => now,
  });
  const reviewId = "review" in bootstrapResult ? bootstrapResult.review.reviewId : null;
  humanReviewBootstrap = {
      status:
        bootstrapResult.outcome === "created" || bootstrapResult.outcome === "reused"
          ? "succeeded"
          : bootstrapResult.outcome === "failed"
            ? "failed"
            : "skipped",
      candidateId: savedCandidate.candidateId,
      outcome: bootstrapResult.outcome,
      reviewId,
      error: bootstrapResult.outcome === "failed" ? bootstrapResult.error : null,
      reason: bootstrapResult.outcome === "skipped" ? bootstrapResult.reason : null,
    };

  // Canonical Asset → Human Asset Approval → Channel Editors (MQ-4).
  // Governance already ran upstream; unsafe asset cannot become approved silently
  // (deterministic validate + human approval before channel generation).
  let publishableGeneration: Record<string, unknown> = { status: "skipped" };
  let canonicalAssetGeneration: Record<string, unknown> = { status: "skipped" };
  let publishableBundle: import("@/lib/marketing/publishable/contracts").PublishableContentBundle | null =
    null;
  let awaitingAssetApproval = false;
  try {
    const govDecision = savedCandidate.governanceDecision?.decision ?? null;
    if (govDecision === "BLOCK") {
      publishableGeneration = {
        status: "skipped",
        reason: "governance_block",
      };
      canonicalAssetGeneration = { status: "skipped", reason: "governance_block" };
    } else {
      const { resolveMarketingAssetRoot } = await import("@/lib/marketing/assets/config");
      const { resolvePackageDirectory, ensurePackageLayout } = await import(
        "@/lib/marketing/assets/paths"
      );
      const { exportMarketingCandidatePackage } = await import(
        "@/lib/marketing/assets/exportMarketingCandidatePackage"
      );
      const { mkdirSync } = await import("node:fs");
      const assetRoot = resolveMarketingAssetRoot({});
      const packageRoot = resolvePackageDirectory({
        assetRoot,
        businessDateKst: savedCandidate.businessDateKst,
        candidateId: savedCandidate.candidateId,
      });
      mkdirSync(packageRoot, { recursive: true });
      ensurePackageLayout(packageRoot);

      const {
        ensureCanonicalMarketingAsset,
        persistCanonicalAssetToPackage,
        attachCanonicalAssetToCandidate,
        isApprovedCanonicalAsset,
        PRODUCTION_OUTCOME_AWAITING_ASSET_APPROVAL,
        readCanonicalAssetFromPackage,
      } = await import("@/lib/marketing/canonicalAsset");
      const { createStoryPointHash } = await import("@/lib/marketing/storyPoint/hash");

      const storyPoint =
        storyPointCandidateSet?.outcome === "pass" && storyPointCandidateSet.primaryStoryPointId
          ? (storyPointCandidateSet.candidates.find(
              (c) => c.pointId === storyPointCandidateSet.primaryStoryPointId,
            ) ?? null)
          : null;
      const proposition = savedCandidate.contentPlan?.proposition ?? null;
      const evidenceBrief = audienceContentResearchBrief?.evidenceBackedStoryBrief ?? null;
      const assetInvoke =
        deps.invokeAssetSourceWriter ?? deps.invokePublishableComposer ?? null;

      let workingCandidate = savedCandidate;
      if (storyPoint && proposition && assetInvoke) {
        const existingAsset =
          readCanonicalAssetFromPackage(packageRoot) ??
          savedCandidate.canonicalMarketingAsset ??
          null;
        const assetResult = await ensureCanonicalMarketingAsset({
          agendaId: savedCandidate.selectedAgenda.id,
          storyPoint,
          storyPointHash:
            storyPointCandidateSet?.primaryStoryPointHash ?? createStoryPointHash(storyPoint),
          evidenceBrief,
          proposition,
          topicIdentitySummary: [
            savedCandidate.selectedAgenda.title,
            savedCandidate.selectedAgenda.destinations?.join(", ") ?? "",
            savedCandidate.contentAssignment.topic,
          ]
            .filter(Boolean)
            .join(" · "),
          brandContextKo: null,
          existing: existingAsset,
          invoke: assetInvoke,
          now,
        });
        canonicalAssetGeneration = {
          status:
            assetResult.outcome === "validation_failed" || assetResult.outcome === "parse_failed"
              ? "failed"
              : assetResult.outcome === "invoke_missing"
                ? "skipped"
                : "succeeded",
          outcome: assetResult.outcome,
          repairCount: assetResult.repairCount,
          llmCallCount: assetResult.llmCallCount,
          sourceRevision: assetResult.sourceRevision,
          assetId: assetResult.asset?.assetId ?? null,
          version: assetResult.asset?.version ?? null,
          assetStatus: assetResult.asset?.status ?? null,
          validationIssueCount: assetResult.validationIssues.length,
          storyPointId: storyPoint.pointId,
          evidenceRevision: assetResult.writerInput.evidenceRevision,
          propositionRevision: assetResult.writerInput.proposition.propositionRevision,
        };
        if (assetResult.asset) {
          persistCanonicalAssetToPackage({ packageRoot, asset: assetResult.asset });
          workingCandidate = attachCanonicalAssetToCandidate(savedCandidate, assetResult.asset);
          try {
            savedCandidate = await repo.saveCandidate(workingCandidate);
          } catch {
            savedCandidate = workingCandidate;
          }
        }

        const approved = isApprovedCanonicalAsset(savedCandidate.canonicalMarketingAsset);
        if (!approved) {
          awaitingAssetApproval = true;
          publishableGeneration = {
            status: "skipped",
            reason: PRODUCTION_OUTCOME_AWAITING_ASSET_APPROVAL,
            assetStatus: savedCandidate.canonicalMarketingAsset?.status ?? "missing",
          };
          exportMarketingCandidatePackage({
            candidate: savedCandidate,
            assetRoot,
            now,
            overwriteArtifacts: true,
            audienceContentResearchBrief,
            publishableBundle: null,
            canonicalMarketingAsset: savedCandidate.canonicalMarketingAsset ?? null,
          });
        } else if (deps.invokePublishableComposer) {
          const { ensurePublishableContent } = await import(
            "@/lib/marketing/publishable/ensurePublishableContent"
          );
          publishableBundle = await ensurePublishableContent({
            candidate: savedCandidate,
            packageRoot,
            now,
            invoke: deps.invokePublishableComposer,
            modelProfile: "content-strategist",
            audienceContentResearchBrief,
            approvedCanonicalAsset: savedCandidate.canonicalMarketingAsset,
            persist: true,
          });
          exportMarketingCandidatePackage({
            candidate: savedCandidate,
            assetRoot,
            now,
            overwriteArtifacts: true,
            audienceContentResearchBrief,
            publishableBundle,
            canonicalMarketingAsset: savedCandidate.canonicalMarketingAsset ?? null,
          });
          publishableGeneration = {
            status: "succeeded",
            sourceRevision: publishableBundle.sourceRevision,
            sourceAssetVersion: publishableBundle.sourceAssetVersion ?? null,
            threads: {
              composer: publishableBundle.threads.provenance.composer,
              status: publishableBundle.threads.status,
              publishableSuccess: publishableBundle.threads.publishableSuccess ?? false,
              sourceAssetVersion: publishableBundle.threads.sourceAssetVersion ?? null,
            },
            shortform: {
              composer: publishableBundle.shortform.provenance.composer,
              status: publishableBundle.shortform.status,
              publishableSuccess: publishableBundle.shortform.publishableSuccess ?? false,
              sourceAssetVersion: publishableBundle.shortform.sourceAssetVersion ?? null,
            },
            targetChannels: publishableBundle.targetChannels,
          };
        } else {
          publishableGeneration = {
            status: "skipped",
            reason: "invoke_publishable_missing",
          };
        }
      } else if (!storyPoint || !proposition) {
        // Legacy / story-skip path — keep prior channel generation behavior.
        canonicalAssetGeneration = {
          status: "skipped",
          reason: !storyPoint ? "no_story_point" : "no_proposition",
        };
        if (deps.invokePublishableComposer) {
          const { ensurePublishableContent } = await import(
            "@/lib/marketing/publishable/ensurePublishableContent"
          );
          publishableBundle = await ensurePublishableContent({
            candidate: savedCandidate,
            packageRoot,
            now,
            invoke: deps.invokePublishableComposer,
            modelProfile: "content-strategist",
            audienceContentResearchBrief,
            persist: true,
          });
          exportMarketingCandidatePackage({
            candidate: savedCandidate,
            assetRoot,
            now,
            overwriteArtifacts: true,
            audienceContentResearchBrief,
            publishableBundle,
          });
          publishableGeneration = {
            status: "succeeded",
            sourceRevision: publishableBundle.sourceRevision,
            threads: {
              composer: publishableBundle.threads.provenance.composer,
              status: publishableBundle.threads.status,
              publishableSuccess: publishableBundle.threads.publishableSuccess ?? false,
            },
            shortform: {
              composer: publishableBundle.shortform.provenance.composer,
              status: publishableBundle.shortform.status,
              publishableSuccess: publishableBundle.shortform.publishableSuccess ?? false,
            },
            targetChannels: publishableBundle.targetChannels,
            legacyWithoutCanonicalAsset: true,
          };
        } else {
          publishableGeneration = {
            status: "skipped",
            reason: "invoke_publishable_missing",
          };
        }
      } else {
        canonicalAssetGeneration = { status: "skipped", reason: "invoke_asset_writer_missing" };
        publishableGeneration = {
          status: "skipped",
          reason: "awaiting_asset_writer",
        };
      }
    }
  } catch (error) {
    publishableGeneration = {
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
    };
  }

  // Soft pause: Canonical Asset ready, awaiting human approval before channels.
  if (awaitingAssetApproval) {
    const {
      PRODUCTION_OUTCOME_AWAITING_ASSET_APPROVAL,
    } = await import("@/lib/marketing/canonicalAsset/contracts");
    closeProductionTrace({
      candidateId: savedCandidate.candidateId,
      reviewId,
      governanceReviewId: lastStructuredGovernance?.reviewId ?? run.governanceReviewId ?? null,
    });
    const pausedRun: DailyMarketingRun = {
      ...run,
      status: "completed",
      completedAt: now.toISOString(),
      completedCandidateId: savedCandidate.candidateId,
      failureReason: null,
      metadata: {
        ...run.metadata,
        humanReviewBootstrap,
        publishableGeneration,
        canonicalAssetGeneration,
        productionOutcome: PRODUCTION_OUTCOME_AWAITING_ASSET_APPROVAL,
        shortformBridge: { status: "skipped", reason: PRODUCTION_OUTCOME_AWAITING_ASSET_APPROVAL },
      },
      observability: buildObservability({
        ...run,
        completedCandidateId: savedCandidate.candidateId,
        completedAt: now.toISOString(),
      }),
    };
    await repo.saveRun(pausedRun);
    return {
      idempotent: false,
      run: pausedRun,
      candidate: savedCandidate,
      storyPointCandidateSet,
      audienceContentResearchBrief,
    };
  }

  // CG-2: best-effort shortform brief + source resolution (no PICK / no RenderJob / no publish).
  let shortformBridge: Record<string, unknown> = { status: "skipped" };
  try {
    const { maybeGenerateShortformBriefAndResolve } = await import(
      "@/lib/marketing/assets/shortform/dailyShortformBridge"
    );
    const bridgeResult = await maybeGenerateShortformBriefAndResolve({
      candidate: savedCandidate,
      now,
      audienceContentResearchBrief,
      publishableBundle,
      invokePublishable: deps.invokePublishableComposer ?? null,
    });
    shortformBridge = {
      status: bridgeResult.outcome,
      shortformIntended: bridgeResult.shortformIntended,
      reason: bridgeResult.reason,
      sceneCount: bridgeResult.sceneCount ?? null,
      sourceResolutionPersisted: bridgeResult.sourceResolutionPersisted ?? false,
      error: bridgeResult.error ?? null,
      holderCandidateId: bridgeResult.holderCandidateId ?? null,
    };
  } catch (error) {
    shortformBridge = {
      status: "brief_failed",
      shortformIntended: false,
      reason: "bridge_exception",
      error: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
    };
  }

  closeProductionTrace({
    candidateId: savedCandidate.candidateId,
    reviewId,
    governanceReviewId: lastStructuredGovernance?.reviewId ?? run.governanceReviewId ?? null,
  });

  const completedRun: DailyMarketingRun = {
    ...run,
    status: "completed",
    completedAt: now.toISOString(),
    completedCandidateId: savedCandidate.candidateId,
    failureReason: candidate.status === "blocked" ? "GOVERNANCE_BLOCKED" : null,
    metadata: {
      ...run.metadata,
      humanReviewBootstrap,
      publishableGeneration,
      canonicalAssetGeneration,
      shortformBridge,
    },
    observability: buildObservability({
      ...run,
      completedCandidateId: savedCandidate.candidateId,
      completedAt: now.toISOString(),
      metadata: {
        revisionCount: pipeline.revisionRounds,
        governanceDecision: candidate.governanceDecision?.decision ?? pipeline.governance?.decision ?? null,
        finalStatus: savedCandidate.status,
      },
    }),
  };
  await repo.saveRun(completedRun);

  return {
    idempotent: false,
    run: completedRun,
    candidate: savedCandidate,
    audienceContentResearchBrief,
  };
}
