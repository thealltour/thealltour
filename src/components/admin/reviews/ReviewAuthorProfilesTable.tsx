"use client";

import type { ReviewAuthorProfile } from "@/types/reviewAuthorProfile";
import { ReviewAuthorRiskBadge } from "./ReviewAuthorRiskBadge";
import { ReviewAuthorPatternBadgeList } from "./ReviewAuthorPatternBadgeList";

type ReviewAuthorProfilesTableProps = {
  profiles: ReviewAuthorProfile[];
};

function formatRatio(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function ReviewAuthorProfilesTable({ profiles }: ReviewAuthorProfilesTableProps) {
  if (profiles.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
        작성자 분석에 충분한 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
            <th className="px-3 py-2 text-left font-medium">Author Key</th>
            <th className="px-3 py-2 text-left font-medium">Total</th>
            <th className="px-3 py-2 text-left font-medium">Avg Rating</th>
            <th className="px-3 py-2 text-left font-medium">Verified</th>
            <th className="px-3 py-2 text-left font-medium">Helpful</th>
            <th className="px-3 py-2 text-left font-medium">Avg Len</th>
            <th className="px-3 py-2 text-left font-medium">Low Trust %</th>
            <th className="px-3 py-2 text-left font-medium">Dup %</th>
            <th className="px-3 py-2 text-left font-medium">Extreme %</th>
            <th className="px-3 py-2 text-left font-medium">Trust</th>
            <th className="px-3 py-2 text-left font-medium">Risk</th>
            <th className="px-3 py-2 text-left font-medium">Signals</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.authorKey} className="border-b border-[var(--border)]">
              <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
                {p.authorKey}
              </td>
              <td className="px-3 py-2">{p.totalReviews}</td>
              <td className="px-3 py-2">{p.averageRating.toFixed(1)}</td>
              <td className="px-3 py-2">
                {p.totalReviews > 0
                  ? formatRatio(p.verifiedReviewCount / p.totalReviews)
                  : "—"}
              </td>
              <td className="px-3 py-2">{p.helpfulReceivedTotal}</td>
              <td className="px-3 py-2">{p.averageReviewLength}</td>
              <td className="px-3 py-2">{formatRatio(p.lowTrustReviewRatio)}</td>
              <td className="px-3 py-2">{formatRatio(p.duplicateContentRatio)}</td>
              <td className="px-3 py-2">{formatRatio(p.extremeRatingRatio)}</td>
              <td className="px-3 py-2 font-medium">{p.authorTrustScore}</td>
              <td className="px-3 py-2">
                <ReviewAuthorRiskBadge level={p.authorRiskLevel} />
              </td>
              <td className="max-w-[200px] px-3 py-2">
                <ReviewAuthorPatternBadgeList signals={p.patternSignals} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
