import type { DailyMarketingFailureReason } from "@/lib/marketing/cron/daily/types";

export type MarketingIncidentClass =
  | "business_rule_block"
  | "governance_review_required"
  | "malformed_model_output"
  | "provider_transient"
  | "provider_auth"
  | "runtime_unavailable"
  | "hermes_invocation_failure"
  | "tool_failure"
  | "persistence_failure"
  | "timeout"
  | "invalid_state"
  | "unknown";

export type RecoveryDisposition =
  | "no_retry"
  | "safe_retry"
  | "retry_after_fix"
  | "human_action_required";

export type MarketingIncidentContext = {
  failureReason?: DailyMarketingFailureReason | string | null;
  pipelineFailureCode?: string | null;
  pipelineFailureMessage?: string | null;
  governanceDecision?: string | null;
  candidateStatus?: string | null;
  revisionCount?: number | null;
  governanceReviewId?: string | null;
  /** @deprecated Telemetry absence alone must not imply Runtime outage. Prefer pipelineFailureMessage. */
  runtimeGovernanceObserved?: boolean;
};

export type MarketingIncidentAssessment = {
  incidentClass: MarketingIncidentClass;
  recoveryDisposition: RecoveryDisposition;
  operatorAction: string;
  concernSummary: string;
  revisionAttempted: boolean;
};

function messageIncludes(message: string, needles: string[]): boolean {
  const lower = message.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function isInvalidStatePipelineFailure(message: string): boolean {
  return messageIncludes(message, [
    "cannot read properties of undefined",
    "cannot read property",
    "typeerror",
    "governance_handoff_requires",
    "is not iterable",
    "undefined is not an object",
    "reading 'map'",
  ]);
}

function isExplicitGovernanceRuntimeFailure(message: string): boolean {
  return messageIncludes(message, [
    "governance-auditor runtime failed",
    "governance runtime failed",
  ]);
}

function isExplicitRuntimeGatewayFailure(message: string): boolean {
  return messageIncludes(message, [
    "runtime gateway unavailable",
    "runtime_gateway_unavailable",
    "ai runtime gateway",
    "runtime provider failed",
  ]);
}

function isHermesInvocationFailure(message: string): boolean {
  return messageIncludes(message, ["hermes", "profile invoker", "oneshot timeout"]);
}

function invalidStateAssessment(revisionAttempted: boolean): MarketingIncidentAssessment {
  return {
    incidentClass: "invalid_state",
    recoveryDisposition: "retry_after_fix",
    operatorAction:
      "Fix the deterministic governance handoff defect or missing pipeline inputs before retrying. Do not blind-retry an unfixed code bug.",
    concernSummary:
      "Governance handoff failed before Governance Auditor invocation due to invalid or incomplete pipeline state.",
    revisionAttempted,
  };
}

export function classifyMarketingIncident(context: MarketingIncidentContext): MarketingIncidentAssessment {
  const message = context.pipelineFailureMessage ?? "";
  const revisionAttempted = (context.revisionCount ?? 0) > 0;
  const governanceDecision = context.governanceDecision?.toUpperCase() ?? null;

  // Policy outcomes
  if (context.candidateStatus === "blocked" || context.failureReason === "GOVERNANCE_BLOCKED") {
    return {
      incidentClass: "business_rule_block",
      recoveryDisposition: "no_retry",
      operatorAction: "Review blocked candidate rationale; revise content manually or defer posting.",
      concernSummary: "Governance blocked the content after review.",
      revisionAttempted,
    };
  }

  if (context.candidateStatus === "needs_human_review" || governanceDecision === "REVIEW") {
    return {
      incidentClass: "governance_review_required",
      recoveryDisposition: "human_action_required",
      operatorAction: "Human review is required before any publication decision.",
      concernSummary: "Governance returned REVIEW; automated publish path stopped.",
      revisionAttempted,
    };
  }

  // 1. Explicit persisted pipeline failure — deterministic invalid state
  if (message && isInvalidStatePipelineFailure(message)) {
    const assessment = invalidStateAssessment(revisionAttempted);
    if (messageIncludes(message, ["evidencerefs", "reading 'map'"])) {
      return {
        ...assessment,
        concernSummary:
          "Governance handoff failed before Governance Auditor invocation because contentPlan.evidenceRefs was absent or incomplete.",
      };
    }
    return assessment;
  }

  // Malformed GA structured output (GA was reached)
  if (messageIncludes(message, ["content_plan_validation:malformed_model_output"])) {
    return {
      incidentClass: "malformed_model_output",
      recoveryDisposition: "safe_retry",
      operatorAction: "Retry after confirming Content Strategist structured contentPlan output is valid.",
      concernSummary: "Content Strategist contentPlan failed canonical schema validation.",
      revisionAttempted,
    };
  }

  if (
    messageIncludes(message, ["missing_evidence_for_factual_claims"]) ||
    messageIncludes(message, ["content_plan_validation:invalid_state"])
  ) {
    return {
      incidentClass: "invalid_state",
      recoveryDisposition: "retry_after_fix",
      operatorAction:
        "Fix ContentPlan/evidence propagation or content draft before retry. Do not blind-retry an unfixed contract violation.",
      concernSummary: messageIncludes(message, ["missing_evidence_for_factual_claims"])
        ? "Factual claims are present but required evidence references are missing."
        : "ContentPlan violated canonical contract at the governance boundary.",
      revisionAttempted,
    };
  }

  if (messageIncludes(message, ["governance-auditor returned no allow/review/block", "malformed", "no decision"])) {
    return {
      incidentClass: "malformed_model_output",
      recoveryDisposition: "safe_retry",
      operatorAction: "Retry after confirming Governance Auditor structured JSON output is healthy.",
      concernSummary: "Governance Auditor response could not be parsed into ALLOW/REVIEW/BLOCK.",
      revisionAttempted,
    };
  }

  if (messageIncludes(message, ["auth_error", "unauthorized", "forbidden"])) {
    return {
      incidentClass: "provider_auth",
      recoveryDisposition: "retry_after_fix",
      operatorAction: "Fix Runtime/provider credentials before retrying.",
      concernSummary: "Provider authentication failed during specialist invocation.",
      revisionAttempted,
    };
  }

  if (messageIncludes(message, ["timeout", "timed out"])) {
    return {
      incidentClass: "timeout",
      recoveryDisposition: "safe_retry",
      operatorAction: "Retry when Runtime/Hermes latency is normal; inspect observability for stuck jobs.",
      concernSummary: "Specialist invocation timed out before governance completed.",
      revisionAttempted,
    };
  }

  if (message && isHermesInvocationFailure(message)) {
    return {
      incidentClass: "hermes_invocation_failure",
      recoveryDisposition: "retry_after_fix",
      operatorAction: "Inspect Hermes profile invocation before retrying the daily run.",
      concernSummary: "Hermes specialist invocation failed during the marketing pipeline.",
      revisionAttempted,
    };
  }

  // 3. Explicit Runtime / provider errors (message-backed only)
  if (message && isExplicitRuntimeGatewayFailure(message)) {
    return {
      incidentClass: "runtime_unavailable",
      recoveryDisposition: "safe_retry",
      operatorAction: "Retry after AI Runtime Gateway and provider routes recover.",
      concernSummary: "AI Runtime Gateway or provider route was unavailable.",
      revisionAttempted,
    };
  }

  if (context.failureReason === "RUNTIME_PROVIDER_FAILED") {
    return {
      incidentClass: "runtime_unavailable",
      recoveryDisposition: "safe_retry",
      operatorAction: "Retry after AI Runtime Gateway and provider routes recover.",
      concernSummary: "Runtime provider invocation failed during the daily pipeline.",
      revisionAttempted,
    };
  }

  if (message && isExplicitGovernanceRuntimeFailure(message)) {
    return {
      incidentClass: "provider_transient",
      recoveryDisposition: "safe_retry",
      operatorAction: "Retry the daily marketing run after Runtime/provider health is green.",
      concernSummary: "Governance Auditor Runtime invocation failed after the handoff completed.",
      revisionAttempted,
    };
  }

  if (context.failureReason === "PERSISTENCE_FAILED") {
    return {
      incidentClass: "persistence_failure",
      recoveryDisposition: "retry_after_fix",
      operatorAction: "Inspect Supabase connectivity and candidate persistence errors before retry.",
      concernSummary: "Pipeline output could not be persisted safely.",
      revisionAttempted,
    };
  }

  if (context.pipelineFailureCode === "handoff_failed") {
    return {
      incidentClass: "tool_failure",
      recoveryDisposition: revisionAttempted ? "no_retry" : "safe_retry",
      operatorAction: "Inspect revision handoff failure; retry only if first governance pass never completed.",
      concernSummary: "Automatic revision handoff failed after an initial governance decision.",
      revisionAttempted,
    };
  }

  // governance_unavailable without message detail — do not infer Runtime outage
  if (
    context.pipelineFailureCode === "governance_unavailable" ||
    context.failureReason === "GOVERNANCE_TECHNICAL_FAILURE" ||
    context.failureReason === "GOVERNANCE_FAILED"
  ) {
    if (!message) {
      return {
        incidentClass: "unknown",
        recoveryDisposition: "retry_after_fix",
        operatorAction:
          "Inspect run metadata, pipelineFailure message, and Runtime observability before retry. Absence of governance telemetry alone does not prove Runtime outage.",
        concernSummary:
          "Governance failed with limited persisted evidence. Governance Auditor invocation was not confirmed.",
        revisionAttempted,
      };
    }

    return {
      incidentClass: "unknown",
      recoveryDisposition: "retry_after_fix",
      operatorAction: "Inspect pipelineFailure message and cron logs before retry.",
      concernSummary: `Governance technical failure: ${message.slice(0, 160)}`,
      revisionAttempted,
    };
  }

  return {
    incidentClass: "unknown",
    recoveryDisposition: "retry_after_fix",
    operatorAction: "Inspect run metadata, Runtime observability, and cron logs before retry.",
    concernSummary: `Unhandled failure reason: ${context.failureReason ?? "unknown"}.`,
    revisionAttempted,
  };
}

export function mapPipelineFailureToReason(input: {
  pipelineFailureCode?: string | null;
  pipelineFailureMessage?: string | null;
}): DailyMarketingFailureReason {
  if (input.pipelineFailureCode === "governance_unavailable") {
    return "GOVERNANCE_TECHNICAL_FAILURE";
  }
  if (input.pipelineFailureCode === "content_unavailable") {
    return "CONTENT_STRATEGIST_FAILED";
  }
  if (input.pipelineFailureCode === "handoff_failed") {
    return "GOVERNANCE_TECHNICAL_FAILURE";
  }
  return "GOVERNANCE_FAILED";
}
