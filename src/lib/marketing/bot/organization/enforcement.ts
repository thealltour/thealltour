import type { DepartmentRoute } from "@/lib/marketing/bot/organization/routing";
import type { MarketingBotToolName } from "@/lib/marketing/bot/types";

/** Intents that must go through run_department_orchestration (not persona / delegate_task). */
export const ORCHESTRATION_MANDATORY_INTENTS = [
  "performance",
  "content",
  "governance",
  "content_and_governance",
  "department_status",
] as const;

export type OrchestrationMandatoryIntent = (typeof ORCHESTRATION_MANDATORY_INTENTS)[number];

export type McpToolSideEffectClass =
  | "read_only"
  | "internal_execution"
  | "state_mutation"
  | "external_side_effect";

/**
 * Side-effect classification for thealltour-marketing MCP tools.
 * Used for honest MCP annotations — never mark internal execution as read-only.
 */
export const MARKETING_MCP_SIDE_EFFECT_CLASS: Record<MarketingBotToolName, McpToolSideEffectClass> = {
  get_marketing_context: "read_only",
  search_marketing_memory: "read_only",
  get_performance_evidence: "read_only",
  build_content_brief: "internal_execution",
  evaluate_governance: "internal_execution",
  prepare_marketing_task: "internal_execution",
  review_generated_content: "internal_execution",
  run_department_orchestration: "internal_execution",
};

export function mcpReadOnlyHint(tool: MarketingBotToolName): boolean {
  return MARKETING_MCP_SIDE_EFFECT_CLASS[tool] === "read_only";
}

export function isOrchestrationMandatoryIntent(
  intent: string,
): intent is OrchestrationMandatoryIntent {
  return (ORCHESTRATION_MANDATORY_INTENTS as readonly string[]).includes(intent);
}

/** Soft prompt alone is insufficient — classifiers/tests use this as the contract gate. */
export function departmentOrchestrationRequired(route: Pick<DepartmentRoute, "intent">): boolean {
  return isOrchestrationMandatoryIntent(route.intent);
}

/**
 * Hermes generic delegate_task is not a named marketing specialist profile.
 * It must never satisfy DepartmentAgentResult.actuallyInvoked for registered agents.
 */
export function genericDelegateSatisfiesSpecialistInvocation(): false {
  return false;
}

const GOVERNANCE_CLAIM_RE =
  /\b(ALLOW|REVIEW|BLOCK|publish_ready)\b|거버넌스\s*통과|검수\s*완료|정책\s*준수\s*확인|Governance\s*Auditor\s*승인/i;

export function textClaimsGovernanceResult(text: string): boolean {
  return GOVERNANCE_CLAIM_RE.test(text);
}

export function governanceClaimAllowed(input: {
  governanceInvoked: boolean;
  validatedReviewExists: boolean;
}): boolean {
  return input.governanceInvoked || input.validatedReviewExists;
}

const UNSUPPORTED_PRODUCT_FACT_RE =
  /숨겨진\s*옵션\s*비용|노옵션|노쇼핑|출발\s*확정|포함\s*혜택|보장된\s*혜택|특정\s*(가격|일정|호텔|항공)/i;

export function containsUnsupportedProductFactClaims(text: string): boolean {
  return UNSUPPORTED_PRODUCT_FACT_RE.test(text);
}

const FAKE_ASYNC_PROMISE_RE =
  /결과가\s*(취합|나오|준비)되는\s*대로|나중에\s*알려|분석\s*중이며.*보고드리|결과가\s*나오면\s*알려/i;

export function containsFakeAsyncCompletionPromise(text: string): boolean {
  return FAKE_ASYNC_PROMISE_RE.test(text);
}

export function assertNoFakeAsyncPromise(text: string): void {
  if (containsFakeAsyncCompletionPromise(text)) {
    throw new Error(
      "Fake async completion promise is forbidden; complete synthesis in the same request lifecycle or report failure",
    );
  }
}
