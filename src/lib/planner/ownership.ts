import type { PlannerSession } from "@/types/planner";

export type PlannerOwnershipResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; message: string };

/**
 * Authorization for planner_sessions.
 * - member-linked session: cookie memberId must match member_id (anonymousKey ignored)
 * - anonymous session: anonymousKey must match
 * Client-supplied memberId is never trusted.
 */
export function assertPlannerSessionOwnership(params: {
  session: PlannerSession | null;
  anonymousKey?: string | null;
  cookieMemberId: string | null;
}): PlannerOwnershipResult {
  const { session, anonymousKey, cookieMemberId } = params;
  if (!session) {
    return { ok: false, status: 404, message: "Planner session not found." };
  }

  if (session.memberId) {
    if (!cookieMemberId || cookieMemberId !== session.memberId) {
      return { ok: false, status: 403, message: "Not allowed to access this planner session." };
    }
    return { ok: true };
  }

  if (!anonymousKey || session.anonymousKey !== anonymousKey) {
    return { ok: false, status: 403, message: "Not allowed to access this planner session." };
  }
  return { ok: true };
}
