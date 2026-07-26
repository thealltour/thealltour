"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminLandingAnalyticsFilters from "@/components/admin/landings/AdminLandingAnalyticsFilters";
import AdminLandingAnalyticsSummary from "@/components/admin/landings/AdminLandingAnalyticsSummary";
import AdminLandingAnalyticsTable from "@/components/admin/landings/AdminLandingAnalyticsTable";
import AdminLandingAnalyticsTopPerformers from "@/components/admin/landings/AdminLandingAnalyticsTopPerformers";
import AdminLandingAnalyticsUtmBreakdown from "@/components/admin/landings/AdminLandingAnalyticsUtmBreakdown";
import type {
  LandingAnalyticsRange,
  LandingAnalyticsResponse,
  LandingAnalyticsSort,
} from "@/lib/adminLandings/landingAnalyticsModels";
import {
  parseLandingAnalyticsRangeParam,
  parseLandingAnalyticsSortParam,
} from "@/lib/adminLandings/landingAnalyticsModels";

const AdminLandingAnalyticsTrendChart = dynamic(
  () => import("@/components/admin/landings/AdminLandingAnalyticsTrendChart"),
  {
    loading: () => (
      <div className="h-[280px] animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
    ),
  },
);

const AdminLandingAnalyticsConversionCards = dynamic(
  () => import("@/components/admin/landings/AdminLandingAnalyticsConversionCards"),
  {
    loading: () => (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-36 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
        <div className="h-36 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
      </div>
    ),
  },
);

function emptySummary(): LandingAnalyticsResponse["summary"] {
  return {
    totalViews: 0,
    totalClicks: 0,
    totalSubmits: 0,
    avgCTR: 0,
    avgCVR: 0,
  };
}

function emptyTopPerformers(): LandingAnalyticsResponse["topPerformers"] {
  return { bySubmits: [], byCTR: [], byCVR: [] };
}

function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]"
          />
        ))}
      </div>
      <div className="h-14 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
      <div className="h-[300px] rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-36 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
        <div className="h-36 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
        ))}
      </div>
      <div className="h-72 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
    </div>
  );
}

export default function AdminLandingAnalyticsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const range = parseLandingAnalyticsRangeParam(searchParams.get("range"));
  const sort = parseLandingAnalyticsSortParam(searchParams.get("sort"));

  const [data, setData] = useState<LandingAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    let changed = false;
    if (!p.get("range")) {
      p.set("range", "30d");
      changed = true;
    }
    if (!p.get("sort")) {
      p.set("sort", "submits");
      changed = true;
    }
    if (changed) {
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  const queryKey = searchParams.toString();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams(queryKey);
      if (!p.get("range")) p.set("range", "30d");
      if (!p.get("sort")) p.set("sort", "submits");
      const res = await fetch(`/api/admin/landings/analytics?${p.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as LandingAnalyticsResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "랜딩 성과를 불러오지 못했습니다.");
      }
      const tp = json.topPerformers;
      setData({
        summary: json.summary,
        items: Array.isArray(json.items) ? json.items : [],
        trend: Array.isArray(json.trend) ? json.trend : [],
        topPerformers: {
          bySubmits: Array.isArray(tp?.bySubmits) ? tp.bySubmits : [],
          byCTR: Array.isArray(tp?.byCTR) ? tp.byCTR : [],
          byCVR: Array.isArray(tp?.byCVR) ? tp.byCVR : [],
        },
        utmBreakdown: Array.isArray(json.utmBreakdown) ? json.utmBreakdown : [],
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "랜딩 성과를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [queryKey]);

  useEffect(() => {
    void load();
  }, [load]);

  function pushQuery(next: { range?: LandingAnalyticsRange; sort?: LandingAnalyticsSort }) {
    const p = new URLSearchParams(searchParams.toString());
    if (next.range != null) p.set("range", next.range);
    if (next.sort != null) p.set("sort", next.sort);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  if (loading && !data) {
    return <AnalyticsSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-10 text-center">
        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const summary = data?.summary ?? emptySummary();
  const items = data?.items ?? [];
  const trend = data?.trend ?? [];
  const topPerformers = data?.topPerformers ?? emptyTopPerformers();
  const utmBreakdown = data?.utmBreakdown ?? [];

  const hasNoFunnelActivity =
    summary.totalViews === 0 && summary.totalClicks === 0 && summary.totalSubmits === 0;
  const showGlobalEmptyCopy = !loading && hasNoFunnelActivity;

  return (
    <div className="space-y-6">
      {error && data ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </p>
      ) : null}
      <AdminLandingAnalyticsSummary summary={summary} />
      <AdminLandingAnalyticsFilters
        range={range}
        sort={sort}
        onRangeChange={(r) => pushQuery({ range: r })}
        onSortChange={(s) => pushQuery({ sort: s })}
        disabled={loading}
      />
      {showGlobalEmptyCopy ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-muted)]">
          선택한 기간에 분석할 랜딩 데이터가 없습니다.
        </p>
      ) : null}
      <div className={loading && data ? "space-y-6 opacity-60 transition-opacity" : "space-y-6"}>
        <AdminLandingAnalyticsUtmBreakdown rows={utmBreakdown} />
        <AdminLandingAnalyticsTrendChart trend={trend} />
        <AdminLandingAnalyticsConversionCards summary={summary} trend={trend} />
        <AdminLandingAnalyticsTopPerformers topPerformers={topPerformers} />
        <AdminLandingAnalyticsTable items={items} />
      </div>
      {loading && data ? (
        <p className="text-center text-xs text-[var(--text-muted)]">데이터를 불러오는 중입니다…</p>
      ) : null}
    </div>
  );
}
