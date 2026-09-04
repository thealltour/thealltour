import { randomUUID } from "node:crypto";

import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { runDepartmentPipeline, type DepartmentPipelineDeps } from "@/lib/marketing/bot/organization/pipeline";
import type { PerformanceBrief, PerformanceUnavailable } from "@/lib/marketing/bot/organization/handoffs";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
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
    return {
      idempotent: true,
      run: {
        ...existingRun,
        status: "skipped_idempotent",
        completedCandidateId: existingCandidate.candidateId,
        observability: buildObservability({
          ...existingRun,
          completedCandidateId: existingCandidate.candidateId,
          metadata: {
            ...existingRun.metadata,
            finalStatus: existingCandidate.status,
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

  let handoff;
  try {
    handoff = prepareManagerToContentHandoff(
      {
        ...resolution.input,
        channel: input.channel,
        researchCandidate: resolution.researchCandidate,
        researchBrief: resolution.researchBrief,
        idempotencyKey: logicalRunKey,
      },
      { store: deps.contentAssignmentStore, now },
    );
  } catch {
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
    },
    {
      ...deps,
      governanceReviewStore: deps.governanceReviewStore ?? getDefaultGovernanceReviewStore(),
      requestPerformance: deps.requestPerformance,
    },
  );

  const governanceEnvelopes = pipeline.envelopes.filter(
    (envelope) => envelope.sourceAgent === "governance-auditor" && envelope.targetAgent === "marketing-manager",
  );
  const lastStructuredGovernance = (governanceEnvelopes[governanceEnvelopes.length - 1]?.payload ??
    null) as StructuredGovernanceDecision | null;
  if (lastStructuredGovernance?.reviewId) {
    run.governanceReviewId = lastStructuredGovernance.reviewId;
  }

  if (pipeline.failure?.code === "content_unavailable") {
    return failRun(repo, run, "CONTENT_STRATEGIST_FAILED", now, {
      pipelineFailure: pipeline.failure,
    });
  }
  if (pipeline.failure?.code === "governance_unavailable" || pipeline.failure?.code === "handoff_failed") {
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
  });

  if (jsonContainsForbiddenBotLeak(candidate)) {
    return failRun(repo, run, "PERSISTENCE_FAILED", now);
  }

  let savedCandidate;
  try {
    savedCandidate = await repo.saveCandidate(candidate);
  } catch {
    return failRun(repo, run, "PERSISTENCE_FAILED", now);
  }

  let humanReviewBootstrap: Record<string, unknown> = { status: "skipped", candidateId: savedCandidate.candidateId };
  const bootstrapResult = await bootstrapHumanReviewForCandidate(savedCandidate, {
    reviewRepo,
    now: () => now,
  });
  humanReviewBootstrap = {
      status:
        bootstrapResult.outcome === "created" || bootstrapResult.outcome === "reused"
          ? "succeeded"
          : bootstrapResult.outcome === "failed"
            ? "failed"
            : "skipped",
      candidateId: savedCandidate.candidateId,
      outcome: bootstrapResult.outcome,
      reviewId: "review" in bootstrapResult ? bootstrapResult.review.reviewId : null,
      error: bootstrapResult.outcome === "failed" ? bootstrapResult.error : null,
      reason: bootstrapResult.outcome === "skipped" ? bootstrapResult.reason : null,
    };

  const completedRun: DailyMarketingRun = {
    ...run,
    status: "completed",
    completedAt: now.toISOString(),
    completedCandidateId: savedCandidate.candidateId,
    failureReason: candidate.status === "blocked" ? "GOVERNANCE_BLOCKED" : null,
    metadata: {
      ...run.metadata,
      humanReviewBootstrap,
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

  return { idempotent: false, run: completedRun, candidate: savedCandidate };
}
