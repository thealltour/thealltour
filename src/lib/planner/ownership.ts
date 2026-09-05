import type { PlannerSession } from "@/types/planner";

export type PlannerOwnershipResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; message: string };

/**
 * Authorization for planner_sessions updates.
 * - anonymous session: anonymousKey must match
 * - member-linked session: cookie memberId must match member_id
 * Client-supplied memberId is never trusted (not accepted in body).
 */
export function assertPlannerSessionOwnership(params: {
  session: PlannerSession | null;
  anonymousKey: string;
  cookieMemberId: string | null;
}): PlannerOwnershipResult {
  const { session, anonymousKey, cookieMemberId } = params;
  if (!session) {
    return { ok: false, status: 404, message: "Planner session not found." };
  }

  if (session.memberId) {
    if (!cookieMemberId || cookieMemberId !== session.memberId) {
      return { ok: false, status: 403, message: "Not allowed to update this planner session." };
    }
    // Also require anonymousKey continuity for the same browser flow.
    if (session.anonymousKey !== anonymousKey) {
      return { ok: false, status: 403, message: "Not allowed to update this planner session." };
    }
    return { ok: true };
  }

  if (session.anonymousKey !== anonymousKey) {
    return { ok: false, status: 403, message: "Not allowed to update this planner session." };
  }
  return { ok: true };
}
