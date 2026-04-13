"use client";

import Link from "next/link";
import {
  buildAdminLandingEditHref,
  LANDING_TEMPLATE_LABELS,
} from "@/components/admin/landings/adminLandings.constants";
import { formatLandingAnalyticsRate } from "@/lib/adminLandings/analyticsDisplay";
import type { LandingAnalyticsItem } from "@/lib/adminLandings/landingAnalyticsModels";

type Props = {
  items: LandingAnalyticsItem[];
};

function formatTemplate(t: string): string {
  if (t === "—") return t;
  const k = t as keyof typeof LANDING_TEMPLATE_LABELS;
  return LANDING_TEMPLATE_LABELS[k] ?? t;
}

function taxonomyLabel(t: string | null): string {
  if (!t) return "—";
  if (t === "destination") return "지역";
  if (t === "theme") return "테마";
  if (t === "product_line") return "상품군";
  return t;
}

export default function AdminLandingAnalyticsTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-6 py-16 text-center text-sm text-[var(--text-muted)]">
        선택한 기간에 분석할 랜딩 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border)] text-sm">
          <thead className="bg-[var(--surface-muted)] text-left text-xs text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">랜딩 제목</th>
              <th className="px-4 py-3 font-medium">slug</th>
              <th className="px-4 py-3 font-medium">템플릿</th>
              <th className="px-4 py-3 font-medium">taxonomy</th>
              <th className="px-4 py-3 font-medium text-right">view</th>
              <th className="px-4 py-3 font-medium text-right">CTA 클릭</th>
              <th className="px-4 py-3 font-medium text-right">submit</th>
              <th className="px-4 py-3 font-medium text-right">CTR</th>
              <th className="px-4 py-3 font-medium text-right">CVR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]">
            {items.map((row) => {
              const rowInner = (
                <>
                  <td className="px-4 py-3 font-medium">
                    {row.landingId ? (
                      <Link
                        href={buildAdminLandingEditHref(row.landingId)}
                        className="text-[var(--primary)] underline-offset-2 hover:underline"
                      >
                        {row.title}
                      </Link>
                    ) : (
                      <span>{row.title}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{row.landingSlug}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{formatTemplate(row.templateType)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{taxonomyLabel(row.taxonomyType)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.views}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.clicks}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.submits}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                    {formatLandingAnalyticsRate(row.ctr, 1)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                    {formatLandingAnalyticsRate(row.cvr, 1)}
                  </td>
                </>
              );
              return <tr key={row.landingSlug}>{rowInner}</tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
