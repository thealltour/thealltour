import { applyApprovalDecision } from "@/lib/marketing/governance/applyApprovalDecision";
import type { ApprovalDecision } from "@/lib/marketing/governance/workflowTypes";
import {
  GOVERNANCE_REASON_CODES,
  type GovernanceReason,
  type GovernanceReasonCode,
} from "@/lib/marketing/governance/types";
import type { HumanApprovalHandoff } from "@/lib/marketing/bot/types";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
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
import type {
  ContentDraftRequest,
  ContentStrategistOutput,
  GovernanceReviewResult,
  PerformanceBrief,
} from "@/lib/marketing/bot/organization/handoffs";

export const DEPARTMENT_PIPELINE_STATUSES = [
  "publish_ready",
  "approval_pending",
  "revision_required",
  "handoff_failed",
  "approved",
  "rejected",
] as const;

export type DepartmentPipelineStatus = (typeof DEPARTMENT_PIPELINE_STATUSES)[number];

export type PerformanceUnavailable = { unavailable: true; reason: string };

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

export async function runDepartmentPipeline(
  input: DepartmentPipelineInput,
  deps: DepartmentPipelineDeps,
): Promise<DepartmentPipelineResult> {
  const envelopes: Array<HandoffEnvelope<unknown>> = [];
  let performance: PerformanceBrief | PerformanceUnavailable | undefined;
  let revisionRounds = 0;

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
  };

  async function draftOnce(constraints: string[]): Promise<ContentStrategistOutput> {
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
    const draft = await deps.requestDraft(env);
    assertClean(draft);
    if (!draft?.body?.trim()) {
      throw new MarketingBotValidationError("Content Strategist returned an empty draft");
    }
    return draft;
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
    return normalized.handoff;
  }

  let draft: ContentStrategistOutput;
  try {
    draft = await draftOnce(draftRequest.constraints);
  } catch (error) {
    const message =
      error instanceof ContentPlanContractError
        ? error.toPipelineMessage()
        : error instanceof Error
          ? error.message
          : "content_unavailable";
    return {
      status: "handoff_failed",
      publishActionIncluded: false,
      agentIdentityEnforcement: AGENT_IDENTITY_ENFORCEMENT,
      performance,
      envelopes,
      revisionRounds,
      failure: { code: "content_unavailable", message },
      nextAction: "safe_stop",
    };
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
    return {
      status: "handoff_failed",
      publishActionIncluded: false,
      agentIdentityEnforcement: AGENT_IDENTITY_ENFORCEMENT,
      performance,
      draft,
      envelopes,
      revisionRounds,
      failure: { code: "governance_unavailable", message },
      nextAction: "safe_stop",
    };
  }

  if (governance.decision === "BLOCK" && revisionRounds < MAX_AUTO_REVISION_ROUNDS) {
    revisionRounds += 1;
    const revisionConstraints = [
      ...draftRequest.constraints,
      ...governance.revisionHints.map((hint) => `revision: ${hint}`),
    ];
    try {
      draft = await draftOnce(revisionConstraints);
      governance = await reviewOnce(draft, revisionRounds);
    } catch (error) {
      const message =
        error instanceof ContentPlanContractError
          ? error.toPipelineMessage()
          : error instanceof Error
            ? error.message
            : "revision_handoff_failed";
      return {
        status: "handoff_failed",
        publishActionIncluded: false,
        agentIdentityEnforcement: AGENT_IDENTITY_ENFORCEMENT,
        performance,
        draft,
        governance,
        envelopes,
        revisionRounds,
        failure: { code: "handoff_failed", message },
        nextAction: "safe_stop",
      };
    }
  }

  const status = statusFromGovernance(governance);
  const approvalHandoff = status === "approval_pending" ? toApprovalHandoff(draft, governance) : null;

  return {
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
  };
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
