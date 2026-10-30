export const PLANNER_QUOTA_SUBJECT_TYPES = ["member", "anonymous_key"] as const;
export type PlannerQuotaSubjectType = (typeof PLANNER_QUOTA_SUBJECT_TYPES)[number];

export const PLANNER_QUOTA_WINDOW_TYPES = ["kst_day", "lifetime"] as const;
export type PlannerQuotaWindowType = (typeof PLANNER_QUOTA_WINDOW_TYPES)[number];

export const PLANNER_QUOTA_STATUSES = ["reserved", "consumed"] as const;
export type PlannerQuotaStatus = (typeof PLANNER_QUOTA_STATUSES)[number];

/** Mirrored in SQL default p_stale_after_ms. */
export const PLANNER_QUOTA_RESERVATION_TTL_MS = 15 * 60 * 1000;

export const PLANNER_QUOTA_ERROR_CODES = [
  "AI_DAILY_QUOTA_EXCEEDED",
  "ANONYMOUS_LIFETIME_QUOTA_EXCEEDED",
  "GENERATION_ALREADY_IN_PROGRESS",
] as const;

export type PlannerQuotaErrorCode = (typeof PLANNER_QUOTA_ERROR_CODES)[number];

export type PlannerQuotaSubject = {
  subjectType: PlannerQuotaSubjectType;
  subjectId: string;
  windowType: PlannerQuotaWindowType;
  windowKey: string;
};

export type ReservePlannerQuotaResult =
  | "reserved"
  | "already_consumed"
  | "already_reserved";

export type PlannerQuotaBlockedReason =
  | "daily_exceeded"
  | "lifetime_exceeded"
  | "already_in_progress";
