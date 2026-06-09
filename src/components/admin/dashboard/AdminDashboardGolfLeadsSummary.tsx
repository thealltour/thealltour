"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

type GolfSummary = {
  total: number;
  totalActualRevenue: number;
  byUtmSource: Array<{ key: string; label: string; count: number }>;
};

export default function AdminDashboardGolfLeadsSummary() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "golf-leads-summary", "30d"],
    queryFn: async () => {
      const res = await fetch("/api/admin/golf-leads?range=30d&limit=1", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as { summary?: GolfSummary };
      return json.summary ?? null;
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="h-16 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
      </div>
    );
  }

  if (isError || !data) return null;

  const topSource = data.byUtmSource?.[0];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">골프 리드 (UTM)</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">최근 30일 UTM 유입 리드 요약</p>
        </div>
        <Link
          href="/theall_manager_only/golf-leads"
          className="text-xs font-medium text-[var(--primary)] hover:underline"
        >
          상세 보기
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
          <p className="text-[11px] text-[var(--text-muted)]">리드 수</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{data.total}</p>
        </div>
        <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
          <p className="text-[11px] text-[var(--text-muted)]">실매출 합계</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {data.totalActualRevenue.toLocaleString()}원
          </p>
        </div>
        {topSource ? (
          <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 col-span-2 md:col-span-1">
            <p className="text-[11px] text-[var(--text-muted)]">상위 UTM 소스</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {topSource.label} ({topSource.count})
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
