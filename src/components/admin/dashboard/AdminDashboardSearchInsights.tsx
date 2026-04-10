"use client";

import AdminCard from "@/components/admin/ui/AdminCard";
import type { SearchInsightsModel } from "./useSearchInsights";

type AdminDashboardSearchInsightsProps = {
  model: SearchInsightsModel;
  isLoading?: boolean;
};

function topItemLabel(item: { label?: string; taxonomySlug?: string | null; key: string }) {
  return (item.label && item.label.trim()) || (item.taxonomySlug && item.taxonomySlug.trim()) || item.key || "—";
}

export default function AdminDashboardSearchInsights({ model, isLoading }: AdminDashboardSearchInsightsProps) {
  if (isLoading) {
    return (
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4"
          />
        ))}
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <AdminCard variant="glass" className="p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">인기 검색어</h3>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">선택 기간 동안 가장 많이 검색된 키워드입니다.</p>
        {model.topSearchKeywords.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--text-muted)]">집계된 검색어가 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {model.topSearchKeywords.map((item, index) => (
              <li
                key={`${item.keyword}-${index}`}
                className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-2 last:border-0 last:pb-0"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-primary)]">
                  <span className="shrink-0 text-[11px] font-medium text-[var(--text-muted)]">{index + 1}.</span>
                  <span className="truncate">{item.keyword || "—"}</span>
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--text-secondary)]">
                  {Number(item.count).toLocaleString()}회
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard variant="glass" className="p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">검색 무결과</h3>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">결과가 비어 있던 검색어입니다. 콘텐츠·키워드 보강에 참고하세요.</p>
        {model.topNoResultKeywords.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--text-muted)]">무결과 키워드가 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {model.topNoResultKeywords.map((item, index) => (
              <li
                key={`${item.keyword}-nr-${index}`}
                className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-2 last:border-0 last:pb-0"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-primary)]">
                  <span className="shrink-0 text-[11px] font-medium text-[var(--warning)]">{index + 1}.</span>
                  <span className="truncate">{item.keyword || "—"}</span>
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--text-secondary)]">
                  {Number(item.noResultCount ?? item.count).toLocaleString()}회
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard variant="glass" className="p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">메가메뉴·탐색 클릭</h3>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">메가메뉴에서 많이 연 항목입니다.</p>
        {model.topMegaMenuItems.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--text-muted)]">집계된 클릭이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {model.topMegaMenuItems.map((item, index) => (
              <li
                key={`${item.key}-mm-${index}`}
                className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-2 last:border-0 last:pb-0"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-primary)]">
                  <span className="shrink-0 text-[11px] font-medium text-[var(--text-muted)]">{index + 1}.</span>
                  <span className="truncate">{topItemLabel(item)}</span>
                  {item.taxonomyType ? (
                    <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{item.taxonomyType}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--text-secondary)]">
                  {Number(item.count).toLocaleString()}회
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </section>
  );
}
