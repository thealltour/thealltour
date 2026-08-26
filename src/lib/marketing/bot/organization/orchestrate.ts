import { PUBLICATION_FLOW_INACTIVE } from "@/lib/marketing/social/publication/governanceBoundary";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import { extractJsonObject } from "@/lib/marketing/bot/organization/envelope";
import type {
  ContentStrategistOutput,
  GovernanceReviewResult,
} from "@/lib/marketing/bot/organization/handoffs";
import { runDepartmentPipeline, type DepartmentPipelineResult } from "@/lib/marketing/bot/organization/pipeline";
import {
  collectDepartmentCronStatus,
  departmentCronIncludesExpectedSchedules,
  type DepartmentCronDeps,
  type DepartmentCronStatus,
} from "@/lib/marketing/bot/organization/departmentCron";
import {
  MAX_ORCHESTRATION_DEPTH,
  assertDispatchBudget,
  defaultHermesAgentRuntime,
  type HermesAgentRuntime,
  type HermesAgentRuntimeResult,
} from "@/lib/marketing/bot/organization/hermesRuntime";
import { routeDepartmentRequest } from "@/lib/marketing/bot/organization/routing";
import { getPerformanceEvidenceTool } from "@/lib/marketing/bot/getPerformanceEvidenceTool";
import type { GetPerformanceEvidenceResult, MarketingBotDeps } from "@/lib/marketing/bot/types";
import { jsonContainsForbiddenBotLeak, stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";
import type { HermesMarketingProfileId } from "@/lib/marketing/bot/organization/envelope";

export const DEPARTMENT_ORCHESTRATION_CONTRACT = "department-orchestration-v1" as const;

export type DepartmentAgentResult = {
  agent: HermesMarketingProfileId;
  executionId: string | null;
  actuallyInvoked: boolean;
  evidenceUsed: string[];
  dataAvailability?: string;
  result: unknown;
  errors: string[];
};

export type DepartmentSynthesis = {
  requested: string;
  consultedAgents: Array<{ agent: HermesMarketingProfileId; actuallyInvoked: boolean }>;
  evidenceAvailability: string | null;
  keyFindings: string[];
  conflictsOrLimitations: string[];
  recommendedActions: string[];
};

export type DepartmentOrchestrationResult = {
  contract: typeof DEPARTMENT_ORCHESTRATION_CONTRACT;
  project: string;
  department: string;
  intent: string;
  /** True when this request class requires the orchestration tool (not persona / cronjob / delegate_task). */
  orchestrationRequired: boolean;
  publicationRequested: boolean;
  publicationFlowInactive: true;
  snsSideEffects: 0;
  agents: DepartmentAgentResult[];
  performanceEvidence?: GetPerformanceEvidenceResult;
  pipeline?: DepartmentPipelineResult;
  cron?: DepartmentCronStatus;
  synthesis: DepartmentSynthesis;
  routingError?: string;
};

export type OrchestrateDepartmentInput = {
  userRequest: string;
  productId?: string | null;
  channel?: string | null;
  depth?: number;
};

export type OrchestrateDepartmentDeps = MarketingBotDeps &
  DepartmentCronDeps & {
    hermesRuntime?: HermesAgentRuntime;
    requestDraft?: Parameters<typeof runDepartmentPipeline>[1]["requestDraft"];
    requestGovernance?: Parameters<typeof runDepartmentPipeline>[1]["requestGovernance"];
  };

const DEFAULT_PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";
const DEFAULT_CHANNEL = "threads";

function asDraft(raw: string): ContentStrategistOutput {
  const value = extractJsonObject(raw) as ContentStrategistOutput;
  if (!value?.body) throw new MarketingBotValidationError("Content Strategist returned no body");
  return {
    title: value.title ?? null,
    body: String(value.body),
    channel: value.channel || DEFAULT_CHANNEL,
    agenda: value.agenda ?? null,
    sourceReferences: Array.isArray(value.sourceReferences) ? value.sourceReferences.map(String) : [],
  };
}

function asGovernance(raw: string): GovernanceReviewResult {
  const value = extractJsonObject(raw) as Record<string, unknown>;
  const decision = String(value.decision ?? "").toUpperCase();
  if (decision !== "ALLOW" && decision !== "REVIEW" && decision !== "BLOCK") {
    throw new MarketingBotValidationError("Governance Auditor returned no ALLOW/REVIEW/BLOCK");
  }
  return {
    decision,
    riskScore: Number(value.riskScore ?? 0),
    reasons: Array.isArray(value.reasons) ? value.reasons.map(String) : [],
    revisionHints: Array.isArray(value.revisionHints) ? value.revisionHints.map(String) : [],
    humanApprovalRequired: Boolean(value.humanApprovalRequired) || decision === "REVIEW",
    semanticAvailable: value.semanticAvailable !== false,
  };
}

function toAgentResult(
  profile: HermesMarketingProfileId,
  invoke: HermesAgentRuntimeResult,
  extras: { evidenceUsed?: string[]; dataAvailability?: string; result?: unknown } = {},
): DepartmentAgentResult {
  return {
    agent: profile,
    executionId: invoke.actuallyInvoked ? invoke.executionId : null,
    actuallyInvoked: invoke.actuallyInvoked,
    evidenceUsed: extras.evidenceUsed ?? [],
    dataAvailability: extras.dataAvailability,
    result: extras.result ?? { stdoutPreview: invoke.stdout.slice(0, 1200), exitCode: invoke.exitCode },
    errors: invoke.error ? [invoke.error] : [],
  };
}

function synthesize(input: {
  request: string;
  intent: string;
  agents: DepartmentAgentResult[];
  evidence?: GetPerformanceEvidenceResult;
  pipeline?: DepartmentPipelineResult;
  cron?: DepartmentCronStatus;
  publicationRequested: boolean;
  routingError?: string;
}): DepartmentSynthesis {
  const findings: string[] = [];
  const limits: string[] = [];
  const actions: string[] = [];

  if (input.routingError) {
    limits.push(input.routingError);
    actions.push("clarify project/department/agent");
  }
  if (input.evidence) {
    findings.push(`performance dataAvailability=${input.evidence.dataAvailability}`);
    findings.push(...input.evidence.managerEvidence.slice(0, 8));
    if (input.evidence.memoryStatus === "unavailable") {
      limits.push("memoryData=unavailable (non-fatal)");
    }
    const missingSns = input.evidence.missingItems.filter((item) => /SNS|Instagram|Threads engagement/i.test(item));
    if (missingSns.length > 0) limits.push("SNS direct metrics unavailable");
  }
  for (const agent of input.agents) {
    if (!agent.actuallyInvoked) {
      limits.push(`${agent.agent} was not actually invoked`);
    } else {
      findings.push(`${agent.agent} invoked executionId=${agent.executionId}`);
    }
    findings.push(...agent.errors.map((error) => `${agent.agent}: ${error}`));
  }
  const governanceInvoked =
    Boolean(input.pipeline?.governance) ||
    input.agents.some((agent) => agent.agent === "governance-auditor" && agent.actuallyInvoked);
  if (input.pipeline) {
    findings.push(`pipeline status=${input.pipeline.status} next=${input.pipeline.nextAction}`);
    if (input.pipeline.governance) {
      findings.push(`governance=${input.pipeline.governance.decision}`);
    }
  }
  const governanceRelevant =
    input.publicationRequested ||
    input.intent === "content" ||
    input.intent === "governance" ||
    input.intent === "content_and_governance";
  if (governanceRelevant && !governanceInvoked) {
    limits.push("거버넌스 검수는 아직 수행되지 않았습니다.");
  }
  if (input.cron) {
    for (const job of input.cron.jobs) {
      findings.push(`${job.schedule} ${job.name} profile=${job.profile} deliver=${job.deliver}`);
    }
    findings.push(
      `gateway source=${input.cron.gateway.source} mode=${input.cron.gateway.gatewayMode} overall=${input.cron.gateway.overall}`,
    );
    if (!departmentCronIncludesExpectedSchedules(input.cron)) {
      limits.push("expected 08:30 performance and 09:00 plan jobs were not both found");
    }
  }
  if (input.publicationRequested) {
    limits.push("publication requested but PUBLICATION_FLOW_INACTIVE=true");
    actions.push("stop_before_publish");
  }
  if (input.intent === "performance" && input.evidence?.dataAvailability === "partial") {
    actions.push("use internal DB evidence; do not invent SNS metrics");
  }
  if (input.pipeline?.status === "approval_pending") actions.push("human_approval");
  if (input.pipeline?.status === "publish_ready" && governanceInvoked) {
    actions.push("stop_before_publish");
  }
  if (!governanceInvoked) {
    actions.push("do_not_claim_ALLOW_REVIEW_BLOCK_or_publish_ready_without_evidence");
  }
  actions.push("complete_in_same_turn_no_fake_async_promise");

  for (const agent of input.agents) {
    if (agent.errors.some((error) => /timeout|timed out|dispatch_failed/i.test(error))) {
      limits.push(`${agent.agent} invocation failed or timed out in this request lifecycle`);
    }
  }

  return {
    requested: input.request.slice(0, 500),
    consultedAgents: input.agents.map((agent) => ({
      agent: agent.agent,
      actuallyInvoked: agent.actuallyInvoked,
    })),
    evidenceAvailability: input.evidence?.dataAvailability ?? null,
    keyFindings: findings.slice(0, 24),
    conflictsOrLimitations: limits.slice(0, 16),
    recommendedActions: actions.slice(0, 8),
  };
}

function specialistPrompt(kind: "performance" | "content" | "governance", payload: unknown): string {
  if (kind === "performance") {
    return [
      "JSON only. You are the Performance Analyst profile. Call get_performance_evidence if needed.",
      "Do not invent SNS metrics. Do not publish. Memory failure is non-fatal.",
      "If internal DB evidence exists and SNS is missing, dataAvailability=partial.",
      `Attached evidence contract: ${JSON.stringify(payload)}`,
      'shape: {"period":{"start":"","end":""},"metrics":[],"observations":[],"confidence":"low","recommendations":[],"dataAvailability":"partial"}',
    ].join("\n");
  }
  if (kind === "content") {
    return [
      "JSON only. ContentDraftRequest 근거로 초안. 없는 혜택/일정 만들지 마. 게시하지 마.",
      JSON.stringify(payload),
      'shape: {"title":"","body":"","channel":"threads","agenda":null,"sourceReferences":[]}',
    ].join("\n");
  }
  return [
    "JSON only. 이 초안을 검사하고 ALLOW/REVIEW/BLOCK만. 게시하지 마. 자동 승인 금지.",
    JSON.stringify(payload),
    'shape: {"decision":"ALLOW","riskScore":0,"reasons":[],"revisionHints":[],"humanApprovalRequired":false,"semanticAvailable":true}',
  ].join("\n");
}

export async function orchestrateDepartmentTask(
  input: OrchestrateDepartmentInput,
  deps: OrchestrateDepartmentDeps = {},
): Promise<DepartmentOrchestrationResult> {
  if ((input.depth ?? 0) >= MAX_ORCHESTRATION_DEPTH) {
    throw new MarketingBotValidationError("Orchestration depth exceeded");
  }
  const runtime = deps.hermesRuntime ?? defaultHermesAgentRuntime;
  const productId = input.productId?.trim() || DEFAULT_PRODUCT;
  const channel = input.channel?.trim() || DEFAULT_CHANNEL;
  let dispatchCount = 0;

  const failRoute = (message: string): DepartmentOrchestrationResult =>
    stripForbiddenBotData({
      contract: DEPARTMENT_ORCHESTRATION_CONTRACT,
      project: "unknown",
      department: "unknown",
      intent: "routing_failed",
      orchestrationRequired: false,
      publicationRequested: false,
      publicationFlowInactive: true as const,
      snsSideEffects: 0 as const,
      agents: [],
      synthesis: synthesize({
        request: input.userRequest,
        intent: "routing_failed",
        agents: [],
        publicationRequested: false,
        routingError: message,
      }),
      routingError: message,
    });

  let route;
  try {
    route = routeDepartmentRequest(input.userRequest);
  } catch (error) {
    return failRoute(error instanceof Error ? error.message : "routing_failed");
  }

  if (!PUBLICATION_FLOW_INACTIVE) {
    throw new MarketingBotValidationError("PUBLICATION_FLOW_INACTIVE must remain true");
  }

  const agents: DepartmentAgentResult[] = [];
  let performanceEvidence: GetPerformanceEvidenceResult | undefined;
  let pipeline: DepartmentPipelineResult | undefined;
  let cron: DepartmentCronStatus | undefined;

  const invokeSpecialist = async (profile: HermesMarketingProfileId, prompt: string) => {
    assertDispatchBudget(dispatchCount, 1);
    dispatchCount += 1;
    return runtime.invoke({ profile, prompt });
  };

  if (route.intent === "department_status") {
    cron = await collectDepartmentCronStatus(
      [route.registry.manager, route.registry.specialists.performance, route.registry.specialists.content, route.registry.specialists.governance],
      deps,
    );
  }

  if (route.intent === "performance") {
    performanceEvidence = await getPerformanceEvidenceTool(
      { productId, channel },
      { buildPerformanceEvidence: deps.buildPerformanceEvidence, now: deps.now },
    );
    const invoke = await invokeSpecialist(
      route.registry.specialists.performance,
      specialistPrompt("performance", {
        contract: performanceEvidence.contract,
        dataAvailability: performanceEvidence.dataAvailability,
        memoryStatus: performanceEvidence.memoryStatus,
        confirmedMetrics: performanceEvidence.confirmedMetrics,
        missingItems: performanceEvidence.missingItems,
        managerEvidence: performanceEvidence.managerEvidence,
        snsDirectCollection: false,
      }),
    );
    let parsed: unknown = invoke.stdout;
    try {
      parsed = extractJsonObject(invoke.stdout);
    } catch {
      parsed = { raw: invoke.stdout.slice(0, 800) };
    }
    agents.push(
      toAgentResult(route.registry.specialists.performance, invoke, {
        evidenceUsed: ["get_performance_evidence", "daily-performance-brief-v1"],
        dataAvailability: performanceEvidence.dataAvailability,
        result: parsed,
      }),
    );
  }

  const runContentGovernance = route.intent === "content_and_governance" || route.intent === "content" || route.intent === "governance";
  if (runContentGovernance && route.intent !== "governance") {
    const requestDraft =
      deps.requestDraft ??
      (async (envelope) => {
        const invoke = await invokeSpecialist(
          route.registry.specialists.content,
          specialistPrompt("content", envelope.payload),
        );
        if (!invoke.actuallyInvoked || invoke.exitCode !== 0) {
          throw new MarketingBotValidationError(invoke.error ?? "content_dispatch_failed");
        }
        const draft = asDraft(invoke.stdout);
        agents.push(
          toAgentResult(route.registry.specialists.content, invoke, {
            evidenceUsed: ["handoff:content_draft"],
            result: draft,
          }),
        );
        return draft;
      });
    const requestGovernance =
      deps.requestGovernance ??
      (async (envelope) => {
        const invoke = await invokeSpecialist(
          route.registry.specialists.governance,
          specialistPrompt("governance", envelope.payload),
        );
        if (!invoke.actuallyInvoked || invoke.exitCode !== 0) {
          throw new MarketingBotValidationError(invoke.error ?? "governance_dispatch_failed");
        }
        const governance = asGovernance(invoke.stdout);
        agents.push(
          toAgentResult(route.registry.specialists.governance, invoke, {
            evidenceUsed: ["handoff:governance_review"],
            result: governance,
          }),
        );
        return governance;
      });

    pipeline = await runDepartmentPipeline(
      {
        productId,
        channel,
        goal: input.userRequest.slice(0, 400),
        constraints: ["do not invent product facts", "do not publish", "PUBLICATION_FLOW_INACTIVE=true"],
      },
      {
        requestDraft,
        requestGovernance,
      },
    );
  } else if (route.intent === "governance") {
    const invoke = await invokeSpecialist(
      route.registry.specialists.governance,
      specialistPrompt("governance", { body: input.userRequest, channel, productId }),
    );
    agents.push(
      toAgentResult(route.registry.specialists.governance, invoke, {
        evidenceUsed: ["handoff:governance_review"],
      }),
    );
  }

  if (jsonContainsForbiddenBotLeak(agents)) {
    throw new MarketingBotValidationError("Orchestration result leaked forbidden fields");
  }

  return stripForbiddenBotData({
    contract: DEPARTMENT_ORCHESTRATION_CONTRACT,
    project: route.project,
    department: route.department,
    intent: route.intent,
    orchestrationRequired: route.orchestrationRequired,
    publicationRequested: route.publicationRequested,
    publicationFlowInactive: true as const,
    snsSideEffects: 0 as const,
    agents,
    performanceEvidence,
    pipeline,
    cron,
    synthesis: synthesize({
      request: input.userRequest,
      intent: route.intent,
      agents,
      evidence: performanceEvidence,
      pipeline,
      cron,
      publicationRequested: route.publicationRequested,
    }),
  });
}
