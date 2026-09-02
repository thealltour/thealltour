import type {
  CompletedMarketingCandidate,
  DailyMarketingRun,
} from "@/lib/marketing/cron/daily/types";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";
import type {
  DailyMarketingOverallStatus,
  OperationsStageStatus,
} from "@/lib/marketing/operations/types";

export type HealthClassificationInput = {
  researchStatus: OperationsStageStatus;
  performanceBriefStatus: OperationsStageStatus;
  marketingRunStatus: OperationsStageStatus;
  candidateStatus: OperationsStageStatus;
  humanReviewStatus: OperationsStageStatus;
  run: DailyMarketingRun | null;
  candidate: CompletedMarketingCandidate | null;
  review: HumanMarketingReview | null;
  duplicateProductionCandidates: number;
  actionRequiredReasons: string[];
};

export function classifyOverallStatus(input: HealthClassificationInput): DailyMarketingOverallStatus {
  if (
    input.marketingRunStatus === "failed" ||
    input.researchStatus === "failed" ||
    input.candidateStatus === "failed"
  ) {
    return "failed";
  }

  if (input.duplicateProductionCandidates > 0) {
    return "failed";
  }

  if (input.run?.status === "completed" && !input.candidate) {
    return "failed";
  }

  if (input.actionRequiredReasons.length > 0) {
    return "action_required";
  }

  const degradedStages = [
    input.researchStatus,
    input.performanceBriefStatus,
    input.marketingRunStatus,
    input.candidateStatus,
    input.humanReviewStatus,
  ];

  if (degradedStages.some((status) => status === "degraded")) {
    return "degraded";
  }

  if (degradedStages.some((status) => status === "pending")) {
    return "degraded";
  }

  return "healthy";
}

export function buildActionRequiredReasons(input: {
  candidate: CompletedMarketingCandidate | null;
  review: HumanMarketingReview | null;
}): string[] {
  const reasons: string[] = [];
  const candidate = input.candidate;
  const review = input.review;

  if (!candidate) return reasons;

  if (candidate.status === "needs_human_review") {
    reasons.push("Governance returned REVIEW; human review required before publication.");
  }

  if (candidate.status === "ready_for_human_review" && (!review || review.status === "pending" || review.status === "editing")) {
    reasons.push("Candidate is ready for human review.");
  }

  if (review?.status === "deferred") {
    reasons.push("Human review was deferred; operator should revisit the queue.");
  }

  if (review?.status === "approved_for_manual_publish" && !review.manualPublication?.externalPostId) {
    reasons.push("Approved for manual publish but no external publication reference recorded yet.");
  }

  if (candidate.status === "blocked") {
    reasons.push("Governance blocked the candidate; revision or operator decision required.");
  }

  return reasons;
}

export function mapRunToStageStatus(run: DailyMarketingRun | null, now: Date, businessDateKst: string): {
  status: OperationsStageStatus;
  message: string;
} {
  if (!run) {
    return {
      status: isBeforeMarketingRunDue(now, businessDateKst) ? "pending" : "failed",
      message: isBeforeMarketingRunDue(now, businessDateKst)
        ? "09:00 daily marketing run has not executed yet for this business date."
        : "No daily marketing run record found for this business date.",
    };
  }

  switch (run.status) {
    case "completed":
      return { status: "healthy", message: "Daily marketing run completed successfully." };
    case "skipped_idempotent":
      return { status: "healthy", message: "Daily marketing run skipped idempotently (already completed)." };
    case "deferred":
      return {
        status: "degraded",
        message: run.failureReason
          ? `Daily marketing run deferred: ${run.failureReason}.`
          : "Daily marketing run deferred pending research or manager preconditions.",
      };
    case "failed":
      return {
        status: "failed",
        message: run.failureReason
          ? `Daily marketing run failed: ${run.failureReason}.`
          : "Daily marketing run failed before candidate persistence.",
      };
    case "started":
      return { status: "degraded", message: "Daily marketing run started but not yet completed." };
    default:
      return { status: "degraded", message: `Daily marketing run status: ${run.status}.` };
  }
}

export function isBeforePerformanceBriefDue(now: Date, businessDateKst: string): boolean {
  return isBeforeKstTime(now, businessDateKst, 8, 30);
}

export function isBeforeMarketingRunDue(now: Date, businessDateKst: string): boolean {
  return isBeforeKstTime(now, businessDateKst, 9, 0);
}

function isBeforeKstTime(now: Date, businessDateKst: string, hour: number, minute: number): boolean {
  const todayKst = formatKstYmdFromDate(now);
  if (businessDateKst !== todayKst) return false;
  const kstMinutes = getKstMinutes(now);
  return kstMinutes < hour * 60 + minute;
}

function getKstMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function formatKstYmdFromDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}
