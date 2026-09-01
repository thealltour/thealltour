import { randomUUID } from "node:crypto";

import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import {
  HUMAN_MARKETING_REVIEW_CONTRACT,
  type HumanMarketingReview,
  type HumanReviewDraft,
  type HumanReviewQueueItem,
} from "@/lib/marketing/review/types";
import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { matchesQueueFilter } from "@/lib/marketing/review/transitions";

export function draftFromContentOutput(draft: ContentStrategistOutput): HumanReviewDraft {
  return {
    title: draft.title ?? null,
    body: draft.body,
    channel: draft.channel,
  };
}

export function createInitialHumanReview(
  candidate: CompletedMarketingCandidate,
  reviewedBy: string | null,
  now = new Date(),
): HumanMarketingReview {
  const draft = draftFromContentOutput(candidate.draft);
  const iso = now.toISOString();
  return {
    contract: HUMAN_MARKETING_REVIEW_CONTRACT,
    reviewId: `hmr_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    candidateId: candidate.candidateId,
    runId: candidate.runId,
    status: "pending",
    originalDraft: draft,
    currentDraft: draft,
    humanNotes: null,
    rejectionReason: null,
    deferredUntil: null,
    manualPublication: null,
    reviewedBy,
    governanceReviewedDraftBody: draft.body,
    humanEditedAfterGovernance: false,
    createdAt: iso,
    updatedAt: iso,
    approvedAt: null,
    manuallyPublishedAt: null,
  };
}

export function toQueueItem(input: {
  candidate: CompletedMarketingCandidate;
  review: HumanMarketingReview | null;
  runDegraded?: boolean;
}): HumanReviewQueueItem {
  const { candidate, review } = input;
  const humanReviewStatus = review?.status ?? null;
  const governanceDecision = candidate.governanceDecision?.decision ?? null;
  const actionNeeded =
    (candidate.status === "ready_for_human_review" || candidate.status === "needs_human_review") &&
    (!humanReviewStatus ||
      humanReviewStatus === "pending" ||
      humanReviewStatus === "editing" ||
      humanReviewStatus === "deferred");

  return {
    candidateId: candidate.candidateId,
    runId: candidate.runId,
    logicalRunKey: candidate.logicalRunKey,
    businessDateKst: candidate.businessDateKst,
    title: candidate.selectedAgenda.title,
    candidateStatus: candidate.status,
    humanReviewStatus,
    governanceDecision,
    channel: candidate.draft.channel,
    revisionCount: candidate.revisionHistory.length,
    createdAt: candidate.createdAt,
    updatedAt: review?.updatedAt ?? candidate.updatedAt,
    degraded: Boolean(input.runDegraded),
    productLinked: (candidate.contentAssignment.matchedProductIds?.length ?? 0) > 0,
    actionNeeded,
    humanEditedAfterGovernance: review?.humanEditedAfterGovernance ?? false,
  };
}

export function filterQueueItems(
  items: HumanReviewQueueItem[],
  filter: import("@/lib/marketing/review/types").HumanReviewQueueFilter,
  now = new Date(),
): HumanReviewQueueItem[] {
  const todayKst = formatKstBusinessDate(now);
  return items.filter((item) =>
    matchesQueueFilter({
      filter,
      businessDateKst: item.businessDateKst,
      todayKst,
      candidateStatus: item.candidateStatus,
      humanReviewStatus: item.humanReviewStatus,
      governanceDecision: item.governanceDecision,
    }),
  );
}

export function sanitizeTextForDisplay(value: string, max = 4_000): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, max);
}

export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
