import { formatKstBusinessDate } from "@/lib/planner/quota/kst";
import type { PlannerQuotaSubject } from "@/lib/planner/quota/types";

/**
 * Server-only quota subject from cookie member + validated anonymousKey.
 * Never trusts client-supplied subjectType / memberId / windowKey.
 */
export function resolvePlannerQuotaSubject(params: {
  cookieMemberId: string | null | undefined;
  anonymousKey: string;
  now?: Date;
}): PlannerQuotaSubject {
  const memberId = params.cookieMemberId?.trim() || "";
  if (memberId) {
    return {
      subjectType: "member",
      subjectId: memberId,
      windowType: "kst_day",
      windowKey: formatKstBusinessDate(params.now ?? new Date()),
    };
  }

  const anonymousKey = params.anonymousKey.trim();
  if (!anonymousKey) {
    throw new Error("anonymous_key_required");
  }

  return {
    subjectType: "anonymous_key",
    subjectId: anonymousKey,
    windowType: "lifetime",
    windowKey: "lifetime",
  };
}
