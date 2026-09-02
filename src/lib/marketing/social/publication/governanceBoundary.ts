/**
 * Governance boundary for PublicationAdapter invocation.
 *
 * Content Strategist / Marketing Manager / cron scripts must NEVER call
 * PublicationAdapter directly.
 *
 * Future:
 * Content → Governance → Human Approval → Publication Orchestrator
 *   → Publication Adapter → Official API
 *
 * STEP 3-1 does not activate this flow (zero SNS side effects).
 */

import type { MarketingAgentRole } from "@/lib/marketing/bot/organization/types";

export const PUBLICATION_ORCHESTRATOR_CALLER = "publication_orchestrator" as const;

export type PublicationAdapterCaller =
  | typeof PUBLICATION_ORCHESTRATOR_CALLER
  | MarketingAgentRole
  | "cron_daily_performance"
  | "cron_daily_plan"
  | "mcp_tool"
  | "unknown";

export const PUBLICATION_ADAPTER_FORBIDDEN_CALLERS = [
  "marketing_manager",
  "content_strategist",
  "governance_auditor",
  "performance_analyst",
  "cron_daily_performance",
  "cron_daily_plan",
  "mcp_tool",
] as const satisfies readonly PublicationAdapterCaller[];

export type ForbiddenPublicationAdapterCaller =
  (typeof PUBLICATION_ADAPTER_FORBIDDEN_CALLERS)[number];

export const PUBLICATION_FLOW_INACTIVE = true as const;
/** STEP 3-1..3-5: architecture/persistence only — no SNS network writes */
export const SNS_SIDE_EFFECTS_STEP_3_1 = 0 as const;
export const SNS_SIDE_EFFECTS_STEP_3_2 = 0 as const;
export const SNS_SIDE_EFFECTS_STEP_3_3 = 0 as const;
export const SNS_SIDE_EFFECTS_STEP_3_4 = 0 as const;
export const SNS_SIDE_EFFECTS_STEP_3_5 = 0 as const;
/** STEP 3-7: daily autonomous pipeline — pre-publication candidate only */
export const SNS_SIDE_EFFECTS_STEP_3_7 = 0 as const;
/** STEP 3-8: human review queue — business-state records only */
export const SNS_SIDE_EFFECTS_STEP_3_8 = 0 as const;
/** STEP 3-9: read-only performance collection — no external writes */
export const PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9 = 0 as const;
/** STEP 3-10: operations status/trace — read-only observability */
export const OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10 = 0 as const;

/**
 * Future:
 * Content → Governance → Human Approval → Publication Orchestrator
 *   → Credential Resolution → Publication Adapter → Official API
 */


export function isAllowedPublicationAdapterCaller(caller: PublicationAdapterCaller): boolean {
  if (PUBLICATION_FLOW_INACTIVE) return false;
  return caller === PUBLICATION_ORCHESTRATOR_CALLER;
}

export function assertCanInvokePublicationAdapter(caller: PublicationAdapterCaller): void {
  if (!isAllowedPublicationAdapterCaller(caller)) {
    throw new Error(
      `PublicationAdapter invocation denied for caller=${caller}. ` +
        `Required path: Content → Governance → Human Approval → Publication Orchestrator. ` +
        `STEP 3-1 keeps publication flow inactive (SNS side effects = 0).`,
    );
  }
}

/** Performance Analyst must stay provider-agnostic — no direct collector calls. */
export function assertPerformanceAnalystDoesNotCallCollector(caller: PublicationAdapterCaller | "performance_pipeline"): void {
  if (caller === "performance_analyst" || caller === "cron_daily_performance") {
    throw new Error(
      "Performance Analyst must not call SNS PerformanceCollector directly. " +
        "Use normalized performance storage / PerformanceMemorySource instead.",
    );
  }
}
