"use client";

import type { ReviewAuthorProfile } from "@/types/reviewAuthorProfile";
import { ReviewAuthorSummaryCards } from "./ReviewAuthorSummaryCards";
import { ReviewAuthorProfilesTable } from "./ReviewAuthorProfilesTable";
import { getHighRiskAuthors } from "@/lib/reviewAuthorSelectors";

type ReviewAuthorProfilesDashboardProps = {
  profiles: ReviewAuthorProfile[];
};

export function ReviewAuthorProfilesDashboard({ profiles }: ReviewAuthorProfilesDashboardProps) {
  const highRisk = getHighRiskAuthors(profiles);
  const mediumRisk = profiles.filter((p) => p.authorRiskLevel === "medium");
  const lowRisk = profiles.filter((p) => p.authorRiskLevel === "low");
  const avgTrust =
    profiles.length > 0
      ? profiles.reduce((s, p) => s + p.authorTrustScore, 0) / profiles.length
      : 0;

  return (
    <div className="space-y-8">
      <ReviewAuthorSummaryCards
        totalAuthors={profiles.length}
        highRiskCount={highRisk.length}
        mediumRiskCount={mediumRisk.length}
        lowRiskCount={lowRisk.length}
        averageAuthorTrust={avgTrust}
      />

      {highRisk.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
            고위험 작성자
          </h2>
          <ReviewAuthorProfilesTable profiles={highRisk} />
        </section>
      )}

      {highRisk.length === 0 && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center text-sm text-[var(--text-muted)]">
          현재 고위험 작성자가 없습니다.
        </p>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
          작성자 프로필 전체
        </h2>
        <ReviewAuthorProfilesTable profiles={profiles} />
      </section>
    </div>
  );
}
