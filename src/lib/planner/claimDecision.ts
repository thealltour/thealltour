/**
 * Pure claim decision helpers (no DB) for tests and documentation of PR-4 rules.
 */
import type { PlannerSession } from "@/types/planner";

export type PlannerClaimDecision =
  | { action: "idempotent_saved" }
  | { action: "mark_saved_for_owner" }
  | { action: "claim_anonymous" }
  | { action: "reject"; reason: "invalid_status" | "forbidden" };

export function decidePlannerClaim(params: {
  session: PlannerSession;
  memberId: string;
  anonymousKey: string;
}): PlannerClaimDecision {
  const { session, memberId, anonymousKey } = params;

  if (session.status === "draft") {
    return { action: "reject", reason: "invalid_status" };
  }

  if (session.memberId === memberId) {
    if (session.status === "saved") return { action: "idempotent_saved" };
    if (session.status === "generated") return { action: "mark_saved_for_owner" };
    return { action: "reject", reason: "invalid_status" };
  }

  if (session.memberId && session.memberId !== memberId) {
    return { action: "reject", reason: "forbidden" };
  }

  // anonymous
  if (session.anonymousKey !== anonymousKey) {
    return { action: "reject", reason: "forbidden" };
  }
  if (session.status !== "generated" && session.status !== "saved") {
    return { action: "reject", reason: "invalid_status" };
  }
  if (session.status === "saved") {
    // anonymous + saved without member should not happen; treat as conflict/forbidden
    return { action: "reject", reason: "forbidden" };
  }
  return { action: "claim_anonymous" };
}
