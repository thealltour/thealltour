"use client";

import Link from "next/link";
import { buildAdminLandingEditHref } from "@/components/admin/landings/adminLandings.constants";
import {
  LANDING_ANALYTICS_MIN_CLICKS_FOR_CVR_TOP,
  LANDING_ANALYTICS_MIN_CLICKS_FOR_CTR_TOP,
  LANDING_ANALYTICS_MIN_VIEWS_FOR_CTR_TOP,
} from "@/components/admin/landings/adminLandingAnalytics.constants";
import { formatLandingAnalyticsRate } from "@/lib/adminLandings/analyticsDisplay";
import type { LandingAnalyticsItem, LandingAnalyticsTopPerformers } from "@/lib/adminLandings/landingAnalyticsModels";

type Props = {
  topPerformers: LandingAnalyticsTopPerformers;
};

function Column({
  title,
  hint,
  rows,
  metric,
}: {
  title: string;
  hint: string;
  rows: LandingAnalyticsItem[];
  metric: "submits" | "ctr" | "cvr";
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-muted)]">{hint}</p>
      <ul className="mt-3 space-y-3">
        {rows.length === 0 ? (
          <li className="text-xs text-[var(--text-muted)]">조건을 만족하는 랜딩이 없습니다.</li>
        ) : (
          rows.map((row, idx) => (
            <li
              key={`${row.landingSlug}-${metric}-${idx}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {row.landingId ? (
                    <Link
                      href={buildAdminLandingEditHref(row.landingId)}
                      className="line-clamp-2 text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                    >
                      {row.title}
                    </Link>
                  ) : (
                    <span className="line-clamp-2 text-sm font-medium text-[var(--text-primary)]">{row.title}</span>
                  )}
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">{row.landingSlug}</p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--text-primary)]">
                  {metric === "submits"
                    ? row.submits.toLocaleString("ko-KR")
                    : formatLandingAnalyticsRate(metric === "ctr" ? row.ctr : row.cvr, 1)}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                v {row.views} · 클릭 {row.clicks} · 문의 {row.submits}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default function AdminLandingAnalyticsTopPerformers({ topPerformers }: Props) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">상위 랜딩</h2>
      <p className="text-xs text-[var(--text-muted)]">문의 전환 · CTR · CVR 기준 자동 강조 (각 최대 5개)</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Column
          title="문의 전환 TOP"
          hint="문의(submit) 수 기준"
          rows={topPerformers.bySubmits}
          metric="submits"
        />
        <Column
          title="CTR TOP"
          hint={`조회 ≥ ${LANDING_ANALYTICS_MIN_VIEWS_FOR_CTR_TOP} 또는 클릭 ≥ ${LANDING_ANALYTICS_MIN_CLICKS_FOR_CTR_TOP} 인 랜딩만`}
          rows={topPerformers.byCTR}
          metric="ctr"
        />
        <Column
          title="CVR TOP"
          hint={`클릭 ≥ ${LANDING_ANALYTICS_MIN_CLICKS_FOR_CVR_TOP} 인 랜딩만`}
          rows={topPerformers.byCVR}
          metric="cvr"
        />
      </div>
    </div>
  );
}
