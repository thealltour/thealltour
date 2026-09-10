import { applyApprovalDecision } from "@/lib/marketing/governance/applyApprovalDecision";
import type { ApprovalDecision } from "@/lib/marketing/governance/workflowTypes";
import {
  GOVERNANCE_REASON_CODES,
  type GovernanceReason,
  type GovernanceReasonCode,
} from "@/lib/marketing/governance/types";
import type { HumanApprovalHandoff } from "@/lib/marketing/bot/types";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import {
  isContentStrategistFormatError,
  isContentStrategistRuntimeError,
} from "@/lib/marketing/cron/marketingPlanSpecialists";
import { ContentPlanContractError } from "@/lib/marketing/content/validation/contentPlanContractError";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import {
  AGENT_IDENTITY_ENFORCEMENT,
  MAX_AUTO_REVISION_ROUNDS,
  createHandoffEnvelope,
  type HandoffEnvelope,
} from "@/lib/marketing/bot/organization/envelope";
import {
  buildGovernanceReviewIdempotencyKey,
  normalizeGovernanceReviewResult,
  prepareContentToGovernanceHandoff,
  recordGovernanceReview,
} from "@/lib/marketing/content/governance";
import { isCompletenessValidatorEnabled } from "@/lib/marketing/content/buildDeliverableRequirements";
import { validateContentCompleteness } from "@/lib/marketing/content/completenessValidator";
import type {
  ContentDraftRequest,
  ContentStrategistOutput,
  GovernanceReviewResult,
  PerformanceBrief,
  PerformanceUnavailable,
} from "@/lib/marketing/bot/organization/handoffs";
import { MARKETING_ATTR, pickMarketingAttributes } from "@/lib/marketing/observability/attributes";
import { sanitizeSpanErrorMessage, truncateSummary } from "@/lib/marketing/observability/privacy";
import { createNoopMarketingTraceRecorder, safeRecorder } from "@/lib/marketing/observability/recorderImpl";
import type { MarketingTraceRecorder } from "@/lib/marketing/observability/recorder";
import type { MarketingTraceActiveContext } from "@/lib/marketing/observability/withSpan";
import { withMarketingSpan } from "@/lib/marketing/observability/withSpan";
import {
  attributesForCompleteness,
  attributesForEvidencePack,
  attributesForGovernance,
  attributesForHumanBoundary,
  attributesForRequirements,
  humanBoundaryHandoffStatus,
} from "@/lib/marketing/observability/stageAttributes";
import type { MarketingTraceCorrelation } from "@/lib/marketing/observability/types";

export const DEPARTMENT_PIPELINE_STATUSES = [
  "publish_ready",
  "approval_pending",
  "revision_required",
  "handoff_failed",
  "approved",
  "rejected",
] as const;

export type DepartmentPipelineStatus = (typeof DEPARTMENT_PIPELINE_STATUSES)[number];

export type { PerformanceUnavailable } from "@/lib/marketing/bot/organization/handoffs";

export type DepartmentPipelineInput = {
  productId: string;
  channel: string;
  goal: string;
  agenda?: string | null;
  brief?: unknown;
  constraints?: string[];
  memoryReferences?: string[];
  contentAssignmentId?: string | null;
  contentAssignment?: import("@/lib/marketing/content/types").ContentAssignment | null;
  contentPlanScaffold?: import("@/lib/marketing/content/types").ContentPlan | null;
  selectedAgenda?: import("@/lib/marketing/content/types").SelectedAgenda | null;
  deliverableRequirements?: import("@/lib/marketing/content/types").ContentDeliverableRequirements | null;
  evidencePack?: import("@/lib/marketing/content/types").EvidencePack | null;
};

export type DepartmentPipelineResult = {
  status: DepartmentPipelineStatus;
  publishActionIncluded: false;
  agentIdentityEnforcement: typeof AGENT_IDENTITY_ENFORCEMENT;
  performance?: PerformanceBrief | PerformanceUnavailable;
  draft?: ContentStrategistOutput;
  governance?: GovernanceReviewResult;
  approvalHandoff?: HumanApprovalHandoff | null;
  envelopes: Array<HandoffEnvelope<unknown>>;
  revisionRounds: number;
  failure?: { code: "content_unavailable" | "governance_unavailable" | "handoff_failed"; message: string };
  nextAction: string;
  /** Soft correlation only — never required for business outcome. */
  traceId?: string | null;
};

export type DepartmentPipelineTraceOpts = {
  recorder?: MarketingTraceRecorder | null;
  /** When set, reuse production root; otherwise department pipeline owns a marketing_production trace. */
  context?: MarketingTraceActiveContext | null;
  correlation?: MarketingTraceCorrelation;
  /** Emit MM / requirements / evidence observation spans from input (default true when tracing). */
  emitHandoffObservationSpans?: boolean;
};

export type DepartmentPipelineDeps = {
  requestDraft: (envelope: HandoffEnvelope<ContentDraftRequest>) => Promise<ContentStrategistOutput>;
  requestGovernance: (
    envelope: HandoffEnvelope<import("@/lib/marketing/content/governance/types").StructuredGovernanceReviewRequest>,
  ) => Promise<GovernanceReviewResult>;
  requestPerformance?: (
    envelope: HandoffEnvelope<{ productId: string; channel: string; lookbackDays: number }>,
  ) => Promise<PerformanceBrief | PerformanceUnavailable>;
  governanceReviewStore?: import("@/lib/marketing/content/governance/store/governanceReviewStore").GovernanceReviewStore;
  trace?: DepartmentPipelineTraceOpts | null;
};

function assertClean(value: unknown): void {
  if (jsonContainsForbiddenBotLeak(value)) {
    throw new MarketingBotValidationError("Pipeline payload cannot include PII or embedding vectors");
  }
}

function toGovernanceReasons(codes: string[]): GovernanceReason[] {
  const known = new Set<string>(GOVERNANCE_REASON_CODES);
  const reasons = codes
    .filter((code): code is GovernanceReasonCode => known.has(code))
    .map((code) => ({ code, severity: "medium" as const }));
  return reasons.length > 0 ? reasons : [{ code: "NO_RISK_SIGNAL", severity: "info" }];
}

function toApprovalHandoff(
  draft: ContentStrategistOutput,
  governance: GovernanceReviewResult,
): HumanApprovalHandoff {
  return {
    type: "approval_required",
    title: draft.title ?? null,
    body: draft.body,
    channel: draft.channel,
    riskScore: governance.riskScore,
    reasons: toGovernanceReasons(governance.reasons),
    semanticMatches: [],
    recommendedAction: "REQUEST_CHANGES",
  };
}

function statusFromGovernance(governance: GovernanceReviewResult): Exclude<
  DepartmentPipelineStatus,
  "handoff_failed" | "approved" | "rejected"
> {
  if (governance.decision === "BLOCK") return "revision_required";
  if (governance.decision === "REVIEW") return "approval_pending";
  if (!governance.semanticAvailable) return "approval_pending";
  return "publish_ready";
}

function nextActionFor(status: DepartmentPipelineStatus): string {
  if (status === "publish_ready") return "stop_before_publish";
  if (status === "approval_pending") return "human_approval";
  if (status === "revision_required") return "revise_content";
  if (status === "approved") return "stop_before_publish";
  if (status === "rejected") return "stop";
  return "safe_stop";
}

function resolveRecorder(deps: DepartmentPipelineDeps): MarketingTraceRecorder {
  return safeRecorder(deps.trace?.recorder ?? createNoopMarketingTraceRecorder());
}

export async function runDepartmentPipeline(
  input: DepartmentPipelineInput,
  deps: DepartmentPipelineDeps,
): Promise<DepartmentPipelineResult> {
  const envelopes: Array<HandoffEnvelope<unknown>> = [];
  let performance: PerformanceBrief | PerformanceUnavailable | undefined;
  let revisionRounds = 0;

  const recorder = resolveRecorder(deps);
  let ownsTrace = false;
  let traceId = deps.trace?.context?.traceId ?? "";
  let rootSpanId = deps.trace?.context?.rootSpanId ?? "";

  try {
    if (!deps.trace?.context) {
      const started = recorder.startTrace({
        traceType: "marketing_production",
        correlation: {
          ...deps.trace?.correlation,
          assignmentId: input.contentAssignmentId ?? input.contentAssignment?.assignmentId ?? null,
        },
      });
      traceId = started.traceId;
      ownsTrace = true;
      rootSpanId = recorder.startSpan({
        traceId,
        name: "marketing.production",
        kind: "orchestration",
        stage: "production_request",
        actorType: "system",
        attributes: pickMarketingAttributes({
          [MARKETING_ATTR.CHANNEL]: input.channel,
          [MARKETING_ATTR.PRODUCT_ID]: input.productId,
          [MARKETING_ATTR.ASSIGNMENT_ID]:
            input.contentAssignmentId ?? input.contentAssignment?.assignmentId ?? "",
        }),
      }).spanId;
    }
  } catch {
    /* never fail production on trace bootstrap */
  }

  const parentSpanId = rootSpanId || undefined;
  const emitHandoff =
    deps.trace?.emitHandoffObservationSpans ?? Boolean(deps.trace?.recorder || ownsTrace);

  const finishTraceSafe = (status: "completed" | "failed" | "partial") => {
    if (!ownsTrace || !traceId) return;
    try {
      if (rootSpanId) {
        recorder.endSpan({
          traceId,
          spanId: rootSpanId,
          status: status === "failed" ? "error" : "ok",
          otelStatusCode: status === "failed" ? "ERROR" : "OK",
        });
      }
      recorder.endTrace({ traceId, status });
    } catch {
      /* ignore */
    }
  };

  const withResult = (result: DepartmentPipelineResult): DepartmentPipelineResult => ({
    ...result,
    traceId: traceId || null,
  });

  if (deps.requestPerformance) {
    const perfEnv = createHandoffEnvelope({
      sourceAgent: "marketing-manager",
      targetAgent: "performance-analyst",
      taskType: "performance_brief",
      productId: input.productId,
      channel: input.channel,
      goal: input.goal,
      contextMemoryRefs: input.memoryReferences ?? [],
      payload: { productId: input.productId, channel: input.channel, lookbackDays: 30 },
    });
    envelopes.push(perfEnv);
    try {
      performance = await deps.requestPerformance(perfEnv);
      assertClean(performance);
    } catch {
      performance = { unavailable: true, reason: "performance_analyst_unavailable" };
    }
  }

  const deliverableRequirements =
    input.deliverableRequirements ?? input.contentAssignment?.deliverableRequirements ?? null;
  const evidencePack = input.evidencePack ?? null;

  if (emitHandoff && traceId && parentSpanId) {
    try {
      await withMarketingSpan(
        recorder,
        {
          traceId,
          parentSpanId,
          name: "marketing.manager",
          kind: "agent",
          stage: "marketing_manager",
          actorType: "hermes_bot",
          actorId: "marketing-manager",
          attributes: pickMarketingAttributes({
            [MARKETING_ATTR.AGENT_PROFILE]: "marketing-manager",
            [MARKETING_ATTR.CHANNEL]: input.channel,
            [MARKETING_ATTR.ASSIGNMENT_ID]: input.contentAssignment?.assignmentId ?? "",
            [MARKETING_ATTR.SELECTED_AGENDA_ID]: input.selectedAgenda?.id ?? "",
            [MARKETING_ATTR.ASSIGNMENT_SUMMARY]: truncateSummary(input.selectedAgenda?.title ?? input.goal),
            [MARKETING_ATTR.REQ_DESTINATION_REQUIRED]: deliverableRequirements?.requiredDestinations ?? [],
          }),
        },
        async () => undefined,
        () => ({
          status: "ok",
          attributes: pickMarketingAttributes({
            [MARKETING_ATTR.RESULT_SUMMARY]: truncateSummary(
              `destinations=${deliverableRequirements?.requiredDestinationCount ?? 0};outputs=${deliverableRequirements?.requiredOutputKinds.length ?? 0}`,
            ),
          }),
        }),
      );

      await withMarketingSpan(
        recorder,
        {
          traceId,
          parentSpanId,
          name: "marketing.deliverable_requirements",
          kind: "deterministic",
          stage: "deliverable_requirements",
          actorType: "typescript_staff",
          actorId: "deliverable_requirements",
          attributes: attributesForRequirements(deliverableRequirements),
        },
        async () => undefined,
        () => ({
          status: deliverableRequirements ? "ok" : "skipped",
          attributes: attributesForRequirements(deliverableRequirements),
        }),
      );

      await withMarketingSpan(
        recorder,
        {
          traceId,
          parentSpanId,
          name: "marketing.evidence_pack",
          kind: "deterministic",
          stage: "evidence_pack",
          actorType: "typescript_staff",
          actorId: "evidence_pack",
          attributes: attributesForEvidencePack(evidencePack),
        },
        async () => undefined,
        () => ({
          status: evidencePack ? "ok" : "skipped",
          attributes: attributesForEvidencePack(evidencePack),
        }),
      );
    } catch {
      /* observation spans must never fail pipeline */
    }
  }

  const draftRequest: ContentDraftRequest = {
    productId: input.productId,
    channel: input.channel,
    goal: input.goal,
    agenda: input.agenda ?? input.selectedAgenda?.title ?? null,
    brief: input.brief ?? null,
    constraints: [
      ...(input.constraints ?? ["do not invent product facts", "do not publish"]),
      ...(input.contentAssignment?.constraints ?? []),
    ].slice(0, 20),
    memoryReferences: input.memoryReferences ?? [],
    contentAssignmentId: input.contentAssignmentId ?? input.contentAssignment?.assignmentId ?? null,
    contentAssignment: input.contentAssignment ?? null,
    contentPlanScaffold: input.contentPlanScaffold ?? null,
    selectedAgenda: input.selectedAgenda ?? null,
    deliverableRequirements,
    evidencePack,
  };

  async function draftOnce(constraints: string[], attempt: number): Promise<ContentStrategistOutput> {
    const env = createHandoffEnvelope({
      sourceAgent: "marketing-manager",
      targetAgent: "content-strategist",
      taskType: "content_draft",
      productId: input.productId,
      channel: input.channel,
      goal: input.goal,
      contextMemoryRefs: input.memoryReferences ?? [],
      payload: { ...draftRequest, constraints },
    });
    envelopes.push(env);

    const runDraft = async () => {
      const drafted = await deps.requestDraft(env);
      assertClean(drafted);
      if (!drafted?.body?.trim()) {
        throw new MarketingBotValidationError("Content Strategist returned an empty draft");
      }
      if (!drafted.contentPlan && input.contentPlanScaffold) {
        return { ...drafted, contentPlan: input.contentPlanScaffold };
      }
      return drafted;
    };

    if (!traceId || !parentSpanId) {
      return runDraft();
    }

    return withMarketingSpan(
      recorder,
      {
        traceId,
        parentSpanId,
        name: "marketing.content_strategist",
        kind: "agent",
        stage: "content_strategist",
        actorType: "hermes_bot",
        actorId: "content-strategist",
        attempt,
        attributes: pickMarketingAttributes({
          [MARKETING_ATTR.AGENT_PROFILE]: "content-strategist",
          [MARKETING_ATTR.CHANNEL]: input.channel,
          [MARKETING_ATTR.REVISION_ROUND]: Math.max(0, attempt - 1),
        }),
      },
      async () => runDraft(),
      () => ({
        status: "ok",
        attributes: pickMarketingAttributes({
          [MARKETING_ATTR.RESULT_SUMMARY]: truncateSummary(`attempt=${attempt};draft_ok`),
        }),
      }),
    );
  }

  async function reviewOnce(
    draft: ContentStrategistOutput,
    priorRevision: number,
  ): Promise<GovernanceReviewResult> {
    const handoff = prepareContentToGovernanceHandoff({
      draft,
      assignment: input.contentAssignment,
      selectedAgenda: input.selectedAgenda,
      contentPlan: draft.contentPlan ?? input.contentPlanScaffold,
      productId: input.productId,
      channel: input.channel,
      priorRevision,
    });

    const idempotencyKey = buildGovernanceReviewIdempotencyKey({
      assignmentId: handoff.request.assignmentId,
      draftBody: draft.body,
      priorRevision,
    });

    recordGovernanceReview({
      request: handoff.request,
      decision: null,
      idempotencyKey,
      store: deps.governanceReviewStore,
    });

    const env = createHandoffEnvelope({
      sourceAgent: "content-strategist",
      targetAgent: "governance-auditor",
      taskType: "governance_review",
      productId: input.productId,
      channel: input.channel,
      goal: input.goal,
      contextMemoryRefs: input.memoryReferences ?? [],
      payload: handoff.request,
    });
    envelopes.push(env);

    const runReview = async () => {
      const raw = await deps.requestGovernance(env);
      assertClean(raw);
      if (!raw?.decision) {
        throw new MarketingBotValidationError("Governance Auditor returned no decision");
      }
      const normalized = normalizeGovernanceReviewResult(raw, handoff.request);
      recordGovernanceReview({
        request: handoff.request,
        decision: normalized.structured,
        idempotencyKey,
        store: deps.governanceReviewStore,
      });
      envelopes.push(
        createHandoffEnvelope({
          sourceAgent: "governance-auditor",
          targetAgent: "marketing-manager",
          taskType: "governance_review",
          productId: input.productId,
          channel: input.channel,
          goal: input.goal,
          contextMemoryRefs: input.memoryReferences ?? [],
          payload: normalized.structured,
        }),
      );
      return { handoff: normalized.handoff, structured: normalized.structured };
    };

    if (!traceId || !parentSpanId) {
      return (await runReview()).handoff;
    }

    const reviewed = await withMarketingSpan(
      recorder,
      {
        traceId,
        parentSpanId,
        name: "marketing.governance_auditor",
        kind: "agent",
        stage: "governance_auditor",
        actorType: "hermes_bot",
        actorId: "governance-auditor",
        attempt: priorRevision + 1,
        attributes: pickMarketingAttributes({
          [MARKETING_ATTR.AGENT_PROFILE]: "governance-auditor",
          [MARKETING_ATTR.REVISION_ROUND]: priorRevision,
        }),
      },
      async () => runReview(),
      (result) => {
        const decision = result.handoff.decision;
        const businessStatus = decision === "BLOCK" ? ("blocked" as const) : ("ok" as const);
        return {
          status: businessStatus,
          otelStatusCode: "OK" as const,
          attributes: attributesForGovernance(result.handoff, result.structured),
        };
      },
    );
    return reviewed.handoff;
  }

  let draft: ContentStrategistOutput;
  try {
    draft = await draftOnce(draftRequest.constraints, 1);
  } catch (error) {
    const message =
      error instanceof ContentPlanContractError
        ? error.toPipelineMessage()
        : isContentStrategistFormatError(error) || isContentStrategistRuntimeError(error)
          ? error.toPipelineMessage()
        : error instanceof Error
          ? error.message
          : "content_unavailable";
    finishTraceSafe("failed");
    return withResult({
      status: "handoff_failed",
      publishActionIncluded: false,
      agentIdentityEnforcement: AGENT_IDENTITY_ENFORCEMENT,
      performance,
      envelopes,
      revisionRounds,
      failure: { code: "content_unavailable", message },
      nextAction: "safe_stop",
    });
  }

  if (isCompletenessValidatorEnabled() && deliverableRequirements) {
    const runCompleteness = async (attempt: number) => {
      const completeness = validateContentCompleteness({
        draft,
        requirements: deliverableRequirements,
        evidencePack,
        contentPlanScaffold: input.contentPlanScaffold,
      });
      draft = completeness.draft;

      if (traceId && parentSpanId) {
        try {
          const span = recorder.startSpan({
            traceId,
            parentSpanId,
            name: "marketing.completeness_validator",
            kind: "validation",
            stage: "completeness_validator",
            actorType: "typescript_staff",
            actorId: "completeness_validator",
            attempt,
            attributes: attributesForCompleteness(deliverableRequirements, completeness),
          });
          recorder.endSpan({
            traceId,
            spanId: span.spanId,
            status: completeness.ok ? "ok" : "revision_required",
            otelStatusCode: "OK",
            attributes: {
              ...attributesForCompleteness(deliverableRequirements, completeness),
              ...(completeness.ok
                ? {}
                : pickMarketingAttributes({
                    [MARKETING_ATTR.REVISION_REASON]: completeness.failures[0]?.code ?? "completeness_fail",
                    [MARKETING_ATTR.REVISION_ROUND]: revisionRounds,
                  })),
            },
          });
        } catch {
          /* ignore */
        }
      }
      return completeness;
    };

    let completeness = await runCompleteness(1);

    if (!completeness.ok && revisionRounds < MAX_AUTO_REVISION_ROUNDS) {
      revisionRounds += 1;
      const completenessConstraints = [
        ...draftRequest.constraints,
        ...completeness.revisionHints.map((hint) => `revision: ${hint}`),
      ];
      try {
        draft = await draftOnce(completenessConstraints, revisionRounds + 1);
        completeness = await runCompleteness(revisionRounds + 1);
      } catch (error) {
        const message =
          error instanceof ContentPlanContractError
            ? error.toPipelineMessage()
            : isContentStrategistFormatError(error) || isContentStrategistRuntimeError(error)
              ? error.toPipelineMessage()
              : error instanceof Error
                ? error.message
                : "completeness_revision_failed";
        finishTraceSafe("failed");
        return withResult({
          status: "handoff_failed",
          publishActionIncluded: false,
          agentIdentityEnforcement: AGENT_IDENTITY_ENFORCEMENT,
          performance,
          draft,
          envelopes,
          revisionRounds,
          failure: { code: "content_unavailable", message },
          nextAction: "safe_stop",
        });
      }
    }

    if (!completeness.ok) {
      if (traceId && parentSpanId) {
        try {
          await withMarketingSpan(
            recorder,
            {
              traceId,
              parentSpanId,
              name: "marketing.human_review_boundary",
              kind: "human_boundary",
              stage: "human_review",
              actorType: "system",
            },
            async () => undefined,
            () => ({
              status: "revision_required" as const,
              otelStatusCode: "OK" as const,
              attributes: attributesForHumanBoundary("revision_required"),
            }),
          );
        } catch {
          /* ignore */
        }
      }
      finishTraceSafe("partial");
      return withResult({
        status: "revision_required",
        publishActionIncluded: false,
        agentIdentityEnforcement: AGENT_IDENTITY_ENFORCEMENT,
        performance,
        draft,
        envelopes,
        revisionRounds,
        nextAction: "safe_stop",
      });
    }
  }

  let governance: GovernanceReviewResult;
  try {
    governance = await reviewOnce(draft, revisionRounds);
  } catch (error) {
    const message =
      error instanceof ContentPlanContractError
        ? error.toPipelineMessage()
        : error instanceof Error
          ? error.message
          : "governance_unavailable";
    finishTraceSafe("failed");
    return withResult({
      status: "handoff_failed",
      publishActionIncluded: false,
      agentIdentityEnforcement: AGENT_IDENTITY_ENFORCEMENT,
      performance,
      draft,
      envelopes,
      revisionRounds,
      failure: { code: "governance_unavailable", message: sanitizeSpanErrorMessage(message) },
      nextAction: "safe_stop",
    });
  }

  if (governance.decision === "BLOCK" && revisionRounds < MAX_AUTO_REVISION_ROUNDS) {
    revisionRounds += 1;
    const revisionConstraints = [
      ...draftRequest.constraints,
      ...governance.revisionHints.map((hint) => `revision: ${hint}`),
    ];
    try {
      draft = await draftOnce(revisionConstraints, revisionRounds + 1);
      if (isCompletenessValidatorEnabled() && deliverableRequirements) {
        const afterGaRevision = validateContentCompleteness({
          draft,
          requirements: deliverableRequirements,
          evidencePack,
          contentPlanScaffold: input.contentPlanScaffold,
        });
        draft = afterGaRevision.draft;
        if (traceId && parentSpanId) {
          try {
            const span = recorder.startSpan({
              traceId,
              parentSpanId,
              name: "marketing.completeness_validator",
              kind: "validation",
              stage: "completeness_validator",
              actorType: "typescript_staff",
              actorId: "completeness_validator",
              attempt: revisionRounds + 1,
              attributes: attributesForCompleteness(deliverableRequirements, afterGaRevision),
            });
            recorder.endSpan({
              traceId,
              spanId: span.spanId,
              status: afterGaRevision.ok ? "ok" : "revision_required",
              otelStatusCode: "OK",
              attributes: attributesForCompleteness(deliverableRequirements, afterGaRevision),
            });
          } catch {
            /* ignore */
          }
        }
        if (!afterGaRevision.ok) {
          finishTraceSafe("partial");
          return withResult({
            status: "revision_required",
            publishActionIncluded: false,
            agentIdentityEnforcement: AGENT_IDENTITY_ENFORCEMENT,
            performance,
            draft,
            envelopes,
            revisionRounds,
            nextAction: "safe_stop",
          });
        }
      }
      governance = await reviewOnce(draft, revisionRounds);
    } catch (error) {
      const message =
        error instanceof ContentPlanContractError
          ? error.toPipelineMessage()
          : error instanceof Error
            ? error.message
            : "revision_handoff_failed";
      finishTraceSafe("failed");
      return withResult({
        status: "handoff_failed",
        publishActionIncluded: false,
        agentIdentityEnforcement: AGENT_IDENTITY_ENFORCEMENT,
        performance,
        draft,
        governance,
        envelopes,
        revisionRounds,
        failure: {
          code: "handoff_failed",
          message: sanitizeSpanErrorMessage(message),
        },
        nextAction: "safe_stop",
      });
    }
  }

  const status = statusFromGovernance(governance);
  const approvalHandoff = status === "approval_pending" ? toApprovalHandoff(draft, governance) : null;

  if (traceId && parentSpanId) {
    try {
      await withMarketingSpan(
        recorder,
        {
          traceId,
          parentSpanId,
          name: "marketing.human_review_boundary",
          kind: "human_boundary",
          stage: "human_review",
          actorType: "system",
          attributes: attributesForHumanBoundary(status),
        },
        async () => undefined,
        () => ({
          status:
            humanBoundaryHandoffStatus(status) === "revision_required"
              ? ("revision_required" as const)
              : ("ok" as const),
          otelStatusCode: "OK" as const,
          attributes: attributesForHumanBoundary(status),
        }),
      );
    } catch {
      /* ignore */
    }
  }

  finishTraceSafe(status === "revision_required" ? "partial" : "completed");

  return withResult({
    status,
    publishActionIncluded: false,
    agentIdentityEnforcement: AGENT_IDENTITY_ENFORCEMENT,
    performance,
    draft,
    governance,
    approvalHandoff,
    envelopes,
    revisionRounds,
    nextAction: nextActionFor(status),
  });
}

export function applyPipelineApproval(
  result: DepartmentPipelineResult,
  decision: ApprovalDecision,
  now = new Date(),
): DepartmentPipelineResult {
  if (result.status !== "approval_pending") {
    throw new MarketingBotValidationError("Human approval applies only to approval_pending pipelines");
  }

  const applied = applyApprovalDecision({
    workflow: {
      workflowState: "approval_pending",
      action: "REQUEST_APPROVAL",
      autoPublishAllowed: false,
      humanApprovalRequired: true,
      revisionRequired: false,
    },
    decision,
    reviewerType: "human",
    now,
  });

  const status: DepartmentPipelineStatus =
    applied.workflowState === "approved"
      ? "approved"
      : applied.workflowState === "rejected"
        ? "rejected"
        : "revision_required";

  return {
    ...result,
    status,
    publishActionIncluded: false,
    approvalHandoff: status === "revision_required" ? result.approvalHandoff : null,
    nextAction: nextActionFor(status),
  };
}
