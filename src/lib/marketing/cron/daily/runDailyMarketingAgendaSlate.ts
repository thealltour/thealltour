/**
 * Human-gated daily agenda slate orchestration (STEP G-1–G-6).
 *
 * Cron path:
 *   research → Validation Hardening cooldown (+ rejected slate cooldown)
 *   → deferred one-day carry → MM multi-curation (or deterministic fallback)
 *   → persist slate → STOP
 *
 * Does NOT create Content Strategy / draft / governance / CompletedMarketingCandidate
 * / Human Review bootstrap. Downstream production remains callable via
 * `runDailyMarketingProductionPipeline` / `runDailyMarketingProductionFromSelection`.
 */
import { randomUUID } from "node:crypto";

import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { resolveAgendaSlateLogicalRunKey } from "@/lib/marketing/cron/daily/acceptanceLogicalRunKey";
import {
  applyResearchIdentityCooldown,
  collectRecentResearchIdentities,
  createEmptyResearchIdentitySet,
  DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
  mergeResearchIdentitySets,
  subtractKstBusinessDays,
  type ResearchIdentitySet,
} from "@/lib/marketing/cron/daily/researchIdentityCooldown";
import { resolveResearchPrecondition } from "@/lib/marketing/cron/daily/resolveMarketingManagerAgenda";
import {
  buildDailyAgendaSlate,
  buildDailyAgendaSlateFromManagerCuration,
  collectRejectedResearchIdentities,
  listDeferredFromPreviousDaySlate,
} from "@/lib/marketing/cron/daily/agendaSlate/buildDailyAgendaSlate";
import {
  buildManagerAgendaSlateCurationPrompt,
  buildManagerAgendaSlateFormatRepairPrompt,
  isManagerFormatParseFailure,
  parseManagerAgendaSlateCurationDetailed,
  type ManagerCurationParseDiagnostics,
} from "@/lib/marketing/cron/daily/agendaSlate/curateManagerAgendaSlate";
import { resolveAgendaSlateTargetSize } from "@/lib/marketing/cron/daily/agendaSlate/config";
import type { DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import type { DailyAgendaSlateRepository } from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import {
  createDailyAgendaSlateRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { MarketingResearchContext } from "@/lib/marketing/research/manager/types";
import { classifyMarketingIncident } from "@/lib/marketing/operations/incidentClassification";
import {
  DAILY_MARKETING_RUN_CONTRACT,
  DAILY_MARKETING_ROUTINE_ID,
  type DailyMarketingFailureReason,
  type DailyMarketingPipelineInput,
  type DailyMarketingPipelineResult,
  type DailyMarketingRun,
  type DailyMarketingRunObservability,
} from "@/lib/marketing/cron/daily/types";

export type DailyAgendaSlatePipelineDeps = {
  repo: DailyMarketingRunRepository;
  slateRepo?: DailyAgendaSlateRepository;
  now?: Date;
  getResearchContext?: () => Promise<MarketingResearchContext>;
  /** One MM reasoning pass returning a multi-candidate slate curation. */
  invokeManagerProfile?: (prompt: string) => Promise<string> | string;
  slateTargetSize?: number;
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
    metadata: { mode: "agenda_slate" },
  };
}

async function failRun(
  repo: DailyMarketingRunRepository,
  run: DailyMarketingRun,
  reason: DailyMarketingFailureReason,
  now: Date,
): Promise<DailyMarketingPipelineResult> {
  const incident = classifyMarketingIncident({
    failureReason: reason,
    pipelineFailureCode: null,
    pipelineFailureMessage: null,
    revisionCount: 0,
    governanceReviewId: null,
  });
  const failed: DailyMarketingRun = {
    ...run,
    status: reason === "RESEARCH_EMPTY" ? "deferred" : "failed",
    failureReason: reason,
    completedAt: now.toISOString(),
    metadata: {
      ...run.metadata,
      mode: "agenda_slate",
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
    }),
  };
  await repo.saveRun(failed);
  return { idempotent: false, run: failed, candidate: null, slate: null };
}

function rejectedIdentitiesToSet(rejected: {
  agendaCandidateIds: string[];
  researchBriefIds: string[];
  canonicalArticleIds: string[];
}): ResearchIdentitySet {
  const set = createEmptyResearchIdentitySet();
  for (const id of rejected.agendaCandidateIds) set.agendaCandidateIds.add(id);
  for (const id of rejected.researchBriefIds) set.researchBriefIds.add(id);
  for (const id of rejected.canonicalArticleIds) set.sourceArticleIds.add(id);
  return set;
}

async function curateOrFallbackSlate(input: {
  research: MarketingResearchContext;
  logicalRunKey: string;
  businessDateKst: string;
  runId: string;
  correlationId: string;
  channel?: string | null;
  targetSize: number;
  deferredCarryover: DailyAgendaSlate["candidates"];
  cooldown: DailyAgendaSlate["cooldown"];
  invokeManagerProfile?: DailyAgendaSlatePipelineDeps["invokeManagerProfile"];
  now: Date;
}): Promise<DailyAgendaSlate> {
  const baseArgs = {
    research: input.research,
    logicalRunKey: input.logicalRunKey,
    businessDateKst: input.businessDateKst,
    runId: input.runId,
    correlationId: input.correlationId,
    channel: input.channel,
    targetSize: input.targetSize,
    deferredCarryover: input.deferredCarryover,
    cooldown: input.cooldown,
    now: input.now,
  };

  if (!input.invokeManagerProfile) {
    return buildDailyAgendaSlate({
      ...baseArgs,
      curation: {
        mode: "deterministic_fallback",
        managerMessage: "manager_profile_not_invoked",
      },
      metadataExtras: {
        managerCuration: {
          managerAttemptCount: 0,
          firstAttemptFailureClass: null,
          finalParseMode: "fallback",
          extractMode: null,
          stdoutLength: 0,
          parsedRawItemCount: 0,
          validatedItemCount: 0,
          formatRetryUsed: false,
        } satisfies ManagerCurationParseDiagnostics,
      },
    });
  }

  try {
    const prompt = buildManagerAgendaSlateCurationPrompt(input.research, input.targetSize);
    const raw1 = await input.invokeManagerProfile(prompt);
    let detailed = parseManagerAgendaSlateCurationDetailed(raw1, input.research, input.targetSize);
    let managerAttemptCount = 1;
    let firstAttemptFailureClass = detailed.diagnostics.failureClass;
    let formatRetryUsed = false;

    // Exactly one bounded format-repair retry for JSON/format parse failure only.
    if (isManagerFormatParseFailure(detailed.result)) {
      formatRetryUsed = true;
      managerAttemptCount = 2;
      const repairPrompt = buildManagerAgendaSlateFormatRepairPrompt(
        input.research,
        input.targetSize,
        detailed.diagnostics.failureClass,
      );
      const raw2 = await input.invokeManagerProfile(repairPrompt);
      detailed = parseManagerAgendaSlateCurationDetailed(raw2, input.research, input.targetSize);
    }

    const curationDiagnostics: ManagerCurationParseDiagnostics = {
      managerAttemptCount,
      firstAttemptFailureClass: formatRetryUsed ? firstAttemptFailureClass : null,
      finalParseMode: null,
      extractMode: detailed.diagnostics.extractMode,
      stdoutLength: detailed.diagnostics.stdoutLength,
      parsedRawItemCount: detailed.diagnostics.parsedRawItemCount,
      validatedItemCount: detailed.diagnostics.validatedItemCount,
      formatRetryUsed,
    };

    if (detailed.result.outcome === "curated") {
      curationDiagnostics.finalParseMode = formatRetryUsed
        ? "format_retry"
        : detailed.diagnostics.extractMode;
      return buildDailyAgendaSlateFromManagerCuration({
        ...baseArgs,
        curatedItems: detailed.result.items,
        managerMessage: detailed.result.managerMessage,
        metadataExtras: { managerCuration: curationDiagnostics },
      });
    }

    curationDiagnostics.finalParseMode = "fallback";
    if (!formatRetryUsed && detailed.diagnostics.failureClass) {
      curationDiagnostics.firstAttemptFailureClass = detailed.diagnostics.failureClass;
    }
    return buildDailyAgendaSlate({
      ...baseArgs,
      curation: {
        mode: "deterministic_fallback",
        managerMessage: `manager_${detailed.result.outcome}:${detailed.result.message}`,
      },
      metadataExtras: { managerCuration: curationDiagnostics },
    });
  } catch (error) {
    return buildDailyAgendaSlate({
      ...baseArgs,
      curation: {
        mode: "deterministic_fallback",
        managerMessage: `manager_curation_error:${error instanceof Error ? error.message : "unknown"}`,
      },
      metadataExtras: {
        managerCuration: {
          managerAttemptCount: 1,
          firstAttemptFailureClass: null,
          finalParseMode: "fallback",
          extractMode: null,
          stdoutLength: 0,
          parsedRawItemCount: 0,
          validatedItemCount: 0,
          formatRetryUsed: false,
        } satisfies ManagerCurationParseDiagnostics,
      },
    });
  }
}

export async function runDailyMarketingAgendaSlate(
  input: DailyMarketingPipelineInput & { slateTargetSize?: number },
  deps: DailyAgendaSlatePipelineDeps,
): Promise<DailyMarketingPipelineResult> {
  const now = deps.now ?? new Date();
  const businessDateKst = input.businessDateKst ?? formatKstBusinessDate(now);
  const logicalRunKey = resolveAgendaSlateLogicalRunKey({
    businessDateKst,
    logicalRunKey: input.logicalRunKey,
  });
  const correlationId =
    input.correlationId ?? `daily-marketing-slate:${businessDateKst}:${randomUUID().slice(0, 8)}`;
  const repo = deps.repo;
  const slateRepo =
    deps.slateRepo ??
    (await createDailyAgendaSlateRepository(
      process.env.VITEST || process.env.NODE_ENV === "test" ? { backend: "memory" } : {},
    ));

  const existingSlate = await slateRepo.findByLogicalKey(logicalRunKey);
  const existingRun = await repo.findRunByLogicalKey(logicalRunKey);
  const existingCandidate = await repo.findCandidateByLogicalKey(logicalRunKey);

  // Prefer slate idempotency; also honor legacy completed production candidate.
  if (existingSlate && (existingRun?.status === "slate_ready" || existingRun?.status === "completed")) {
    return {
      idempotent: true,
      run: {
        ...(existingRun ??
          baseRun({
            logicalRunKey,
            businessDateKst,
            correlationId,
            executionAttempt: 1,
            now,
          })),
        status: "skipped_idempotent",
        observability: buildObservability({
          ...(existingRun ?? {}),
          metadata: {
            ...(existingRun?.metadata ?? {}),
            mode: "agenda_slate",
            agendaSlateId: existingSlate.slateId,
            finalStatus: existingSlate.status,
          },
        }),
      },
      candidate: null,
      slate: existingSlate,
    };
  }
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
          metadata: { ...existingRun.metadata, finalStatus: existingCandidate.status },
        }),
      },
      candidate: existingCandidate,
      slate: existingSlate,
    };
  }

  let run = baseRun({
    logicalRunKey,
    businessDateKst,
    correlationId,
    executionAttempt: input.executionAttempt ?? 1,
    now,
  });
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
  const cooledFromProduction = collectRecentResearchIdentities(
    recentCandidates,
    businessDateKst,
    DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
  );

  const recentSlates = await slateRepo.listRecent({
    limit: 14,
    beforeBusinessDateKst: businessDateKst,
  });
  const rejected = collectRejectedResearchIdentities(
    recentSlates,
    businessDateKst,
    DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
  );
  const cooledIdentities = mergeResearchIdentitySets(
    cooledFromProduction,
    rejectedIdentitiesToSet(rejected),
  );
  const cooldownApplied = applyResearchIdentityCooldown(research, cooledIdentities);
  research = cooldownApplied.context;

  run = {
    ...run,
    researchStatus: research.status,
    metadata: {
      ...run.metadata,
      mode: "agenda_slate",
      candidateCount: research.agendaCandidates.length,
      researchIdentityCooldown: {
        days: DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
        excludedAgendaCandidateIds: cooldownApplied.excludedAgendaCandidateIds,
        excludedBriefIds: cooldownApplied.excludedBriefIds,
        rejectedExcludedAgendaCandidateIds: rejected.agendaCandidateIds,
      },
    },
    observability: buildObservability({
      ...run,
      researchStatus: research.status,
      metadata: { candidateCount: research.agendaCandidates.length },
    }),
  };

  const precondition = resolveResearchPrecondition(research);
  // Deferred carry-over may still form a slate even if organic research emptied.
  const previousBusinessDateKst = subtractKstBusinessDays(businessDateKst, 1);
  const previousDaySlate =
    (await slateRepo.findByBusinessDate(previousBusinessDateKst)) ??
    recentSlates.find((s) => s.businessDateKst === previousBusinessDateKst) ??
    null;
  const deferredCarryover = listDeferredFromPreviousDaySlate(
    previousDaySlate,
    previousBusinessDateKst,
  );

  if (!precondition.proceed && deferredCarryover.length === 0) {
    return failRun(repo, run, precondition.reason, now);
  }
  if (precondition.proceed && "degraded" in precondition && precondition.degraded) {
    run = { ...run, degraded: true };
  }

  const targetSize = resolveAgendaSlateTargetSize(input.slateTargetSize ?? deps.slateTargetSize);
  const slate = await curateOrFallbackSlate({
    research:
      precondition.proceed
        ? research
        : {
            ...research,
            status: research.status === "unavailable" ? research.status : "empty",
            agendaCandidates: [],
            briefs: [],
          },
    logicalRunKey,
    businessDateKst,
    runId: run.runId,
    correlationId,
    channel: input.channel,
    targetSize,
    deferredCarryover,
    cooldown: {
      days: DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
      excludedAgendaCandidateIds: cooldownApplied.excludedAgendaCandidateIds,
      excludedBriefIds: cooldownApplied.excludedBriefIds,
      rejectedExcludedAgendaCandidateIds: rejected.agendaCandidateIds,
    },
    invokeManagerProfile: deps.invokeManagerProfile,
    now,
  });

  if (slate.candidates.length === 0 || slate.status === "empty_deferred") {
    return failRun(repo, run, "RESEARCH_EMPTY", now);
  }

  let savedSlate: DailyAgendaSlate;
  try {
    savedSlate = await slateRepo.saveSlate(slate);
  } catch {
    return failRun(repo, run, "PERSISTENCE_FAILED", now);
  }

  const completedRun: DailyMarketingRun = {
    ...run,
    status: "slate_ready",
    completedAt: now.toISOString(),
    completedCandidateId: null,
    failureReason: null,
    metadata: {
      ...run.metadata,
      mode: "agenda_slate",
      agendaSlateId: savedSlate.slateId,
      agendaSlateStatus: savedSlate.status,
      agendaSlateSize: savedSlate.candidates.length,
      curationMode: savedSlate.curation.mode,
      finalStatus: savedSlate.status,
    },
    observability: buildObservability({
      ...run,
      completedAt: now.toISOString(),
      metadata: {
        ...run.metadata,
        candidateCount: savedSlate.candidates.length,
        finalStatus: savedSlate.status,
      },
    }),
  };
  await repo.saveRun(completedRun);

  return {
    idempotent: false,
    run: completedRun,
    candidate: null,
    slate: savedSlate,
  };
}
