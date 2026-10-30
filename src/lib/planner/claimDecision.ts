/**
 * Pure claim decision helpers (no DB) for tests and documentation of PR-4 rules.
 * Ownership attach (login continuation) is separate from save (explicit saved status).
 */
import type { PlannerSession } from "@/types/planner";

export type PlannerClaimDecision =
  | { action: "idempotent_saved" }
  | { action: "mark_saved_for_owner" }
  | { action: "claim_anonymous" }
  | { action: "reject"; reason: "invalid_status" | "forbidden" };

/** Ownership-only attach: sets member_id, keeps status=generated. Does not save. */
export type PlannerOwnershipAttachDecision =
  | { action: "idempotent_owned" }
  | { action: "attach_anonymous" }
  | { action: "reject"; reason: "invalid_status" | "forbidden" };

/**
 * Explicit save decision (may also attach ownership for anonymous generated plans).
 * Login continuation must use decidePlannerOwnershipAttach instead.
 */
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

/**
 * Login continuation: attach member_id only. status stays generated. No save.
 * Requires a usable plan (plan_json present and parseable).
 */
export function decidePlannerOwnershipAttach(params: {
  session: PlannerSession;
  memberId: string;
  anonymousKey: string;
}): PlannerOwnershipAttachDecision {
  const { session, memberId, anonymousKey } = params;

  if (session.memberId === memberId) {
    if (session.status === "generated" || session.status === "saved") {
      return { action: "idempotent_owned" };
    }
    return { action: "reject", reason: "invalid_status" };
  }

  if (session.memberId && session.memberId !== memberId) {
    return { action: "reject", reason: "forbidden" };
  }

  if (session.anonymousKey !== anonymousKey) {
    return { action: "reject", reason: "forbidden" };
  }

  if (session.status !== "generated") {
    return { action: "reject", reason: "invalid_status" };
  }

  if (!session.plan) {
    return { action: "reject", reason: "invalid_status" };
  }

  return { action: "attach_anonymous" };
}
