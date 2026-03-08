"use client";

import type { ReviewReportReason } from "@/types/reviewReports";

const REASON_LABELS: Record<ReviewReportReason, string> = {
  spam: "스팸",
  abusive: "욕설/혐오",
  irrelevant: "무관한 내용",
  misleading: "오해 소지",
  duplicate: "중복",
  other: "기타",
};

type ReviewReportReasonBadgeListProps = {
  reasons: Record<ReviewReportReason, number>;
};

export function ReviewReportReasonBadgeList({ reasons }: ReviewReportReasonBadgeListProps) {
  const entries = (Object.entries(reasons) as [ReviewReportReason, number][]).filter(
    ([_, count]) => count > 0,
  );
  if (entries.length === 0) {
    return <span className="text-xs text-[var(--text-muted)]">신고 사유 없음</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([reason, count]) => (
        <span
          key={reason}
          className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
        >
          {REASON_LABELS[reason]} {count}
        </span>
      ))}
    </div>
  );
}
