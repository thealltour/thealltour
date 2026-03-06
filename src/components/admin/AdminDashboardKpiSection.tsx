"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import AdminCard from "@/components/admin/ui/AdminCard";
import type { AdminAnalyticsOverview } from "@/lib/adminAnalytics";

type AdminCounts = {
  inquiryCount: number;
  productCount: number;
  memberCount: number;
  reviewCount: number;
  totalInquiries: number;
  pendingInquiries: number;
  completedInquiries: number;
  delayedInquiries: number;
  completionRate: number;
  totalInquiriesDeltaPercent?: number | null;
  pendingInquiriesDeltaPercent?: number | null;
  completedInquiriesDeltaPercent?: number | null;
  delayedInquiriesDeltaPercent?: number | null;
};

type DashboardResponse = {
  counts: AdminCounts;
  unreadNotificationCount: number;
  analytics?: AdminAnalyticsOverview | null;
};

/** analytics.summary가 없을 때 사용할 기본값 (전부 0) */
function getSafeAnalyticsSummary(analytics: AdminAnalyticsOverview | null | undefined) {
  const s = analytics?.summary;
  return {
    headerNavClicks: typeof s?.headerNavClicks === "number" ? s.headerNavClicks : 0,
    megaMenuClicks: typeof s?.megaMenuClicks === "number" ? s.megaMenuClicks : 0,
    searchSubmits: typeof s?.searchSubmits === "number" ? s.searchSubmits : 0,
    searchResultClicks: typeof s?.searchResultClicks === "number" ? s.searchResultClicks : 0,
    searchNoResultCount: typeof s?.searchNoResultCount === "number" ? s.searchNoResultCount : 0,
    ctaClicks: typeof s?.ctaClicks === "number" ? s.ctaClicks : 0,
    landingViews: typeof s?.landingViews === "number" ? s.landingViews : 0,
    landingProductClicks: typeof s?.landingProductClicks === "number" ? s.landingProductClicks : 0,
    productCardClicks: typeof s?.productCardClicks === "number" ? s.productCardClicks : 0,
  };
}

function toDirection(value?: number | null): "up" | "down" | undefined {
  if (typeof value !== "number") return undefined;
  return value < 0 ? "down" : "up";
}

export default function AdminDashboardKpiSection() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const currentRange = searchParams.get("range") ?? "7d";
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";

  function updateRange(range: string, from?: string, to?: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("range", range);
    if (range === "custom") {
      if (from) next.set("from", from);
      if (to) next.set("to", to);
    } else {
      next.delete("from");
      next.delete("to");
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery<DashboardResponse>({
    queryKey: ["admin-dashboard", { range: currentRange, from: currentFrom, to: currentTo }],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (currentRange) query.set("range", currentRange);
      if (currentRange === "custom") {
        if (currentFrom) query.set("from", currentFrom);
        if (currentTo) query.set("to", currentTo);
      }
      const queryString = query.toString();
      const url = queryString ? `/api/admin/dashboard?${queryString}` : "/api/admin/dashboard";

      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch admin dashboard data");
      }
      return (await response.json()) as DashboardResponse;
    },
  });

  const { counts } = data ?? {};
  const analyticsSummary = getSafeAnalyticsSummary(data?.analytics);
  const topHeaderItems = (data?.analytics?.topHeaderItems ?? []).slice(0, 5);
  const topSearchKeywords = (data?.analytics?.topSearchKeywords ?? []).slice(0, 5);
  const hasAnalyticsLists = topHeaderItems.length > 0 || topSearchKeywords.length > 0;

  const isLoadingState = isLoading;
  const isErrorState = isError || !data;
  const isEmptyState = !isLoadingState && !isErrorState && !counts;

  return (
    <div className="space-y-3">
      {/* Global date range filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span>기간 선택:</span>
          <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--card)] p-0.5 text-xs">
            {["today", "7d", "30d"].map((rangeKey) => {
              const isActive = currentRange === rangeKey;
              const label =
                rangeKey === "today"
                  ? "오늘"
                  : rangeKey === "7d"
                  ? "최근 7일"
                  : "최근 30일";
              return (
                <button
                  key={rangeKey}
                  type="button"
                  onClick={() => updateRange(rangeKey)}
                  className={`px-2 py-1 rounded-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--brand)] text-white"
                      : "text-[var(--text-muted)] hover:bg-[var(--card-muted)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={currentFrom}
              onChange={(event) => updateRange("custom", event.target.value, currentTo || undefined)}
              className="h-7 rounded border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--text)] outline-none"
            />
            <span>~</span>
            <input
              type="date"
              value={currentTo}
              onChange={(event) => updateRange("custom", currentFrom || undefined, event.target.value)}
              className="h-7 rounded border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--text)] outline-none"
            />
          </div>
        </div>
      </div>

      {/* KPI content */}
      {isLoadingState ? (
        <section className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-6 backdrop-blur-md animate-pulse"
            >
              <div className="h-3 w-16 rounded bg-[var(--border)]" />
              <div className="mt-4 h-7 w-24 rounded bg-[var(--border)]" />
              <div className="mt-3 h-3 w-20 rounded bg-[var(--border)]" />
            </div>
          ))}
        </section>
      ) : isErrorState ? (
        <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-6 text-sm text-[var(--text-primary)] backdrop-blur-md transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-red-600">대시보드 지표를 불러오지 못했습니다.</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                네트워크 상태를 확인한 뒤 다시 시도해 주세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="btn-admin-primary text-xs"
            >
              다시 시도
            </button>
          </div>
        </section>
      ) : isEmptyState ? (
        <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-6 text-sm text-[var(--text-primary)] backdrop-blur-md transition-colors">
          <p className="font-semibold">아직 집계된 지표가 없습니다.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            데이터가 쌓이면 이 영역에서 주요 지표를 확인할 수 있습니다.
          </p>
        </section>
      ) : (
        <div className="flex flex-col space-y-4">
          {/* 문의 KPI 카드 4장 */}
          <section className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-2">
            {counts && (
              <KpiCard
              title="전체 문의 수"
              value={counts.totalInquiries}
              changePercent={counts.totalInquiriesDeltaPercent}
              changeDirection={toDirection(counts.totalInquiriesDeltaPercent)}
              href="/theall_manager_only/inquiries"
            />
            )}
            {counts && (
              <KpiCard
              title="미처리 문의 수"
              value={counts.pendingInquiries}
              changePercent={counts.pendingInquiriesDeltaPercent}
              changeDirection={toDirection(counts.pendingInquiriesDeltaPercent)}
              href="/theall_manager_only/inquiries?status=pending"
            />
            )}
            {counts && (
              <KpiCard
              title="완료된 문의 수"
              value={counts.completedInquiries}
              changePercent={counts.completedInquiriesDeltaPercent}
              changeDirection={toDirection(counts.completedInquiriesDeltaPercent)}
              href="/theall_manager_only/inquiries?status=completed"
            />
            )}
            {counts && (
              <KpiCard
              title="24시간 이상 지연"
              value={counts.delayedInquiries}
              changePercent={counts.delayedInquiriesDeltaPercent}
              changeDirection={toDirection(counts.delayedInquiriesDeltaPercent)}
              href="/theall_manager_only/inquiries?status=delayed"
            />
            )}
          </section>

          {/* 운영 지표: analytics summary 기반 카드 4장 (있으면 표시, 없으면 0 fallback) */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">탐색/전환 지표</h3>
            <div className="mt-2 flex flex-col space-y-3 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-5">
              <KpiCard
                title="헤더 클릭 수"
                value={analyticsSummary.headerNavClicks + analyticsSummary.megaMenuClicks}
              />
              <KpiCard
                title="검색 실행 수"
                value={analyticsSummary.searchSubmits}
              />
              <KpiCard
                title="검색 결과 클릭 수"
                value={analyticsSummary.searchResultClicks}
              />
              <KpiCard
                title="CTA 클릭 수"
                value={analyticsSummary.ctaClicks}
              />
              <KpiCard
                title="상품 클릭 수"
                value={analyticsSummary.productCardClicks}
              />
            </div>
          </section>

          {/* Top list: 상위 헤더 클릭 항목 / 상위 검색어 (읽기 전용) */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AdminCard variant="glass" className="p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                상위 헤더 클릭 항목
              </h3>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                헤더/메가메뉴에서 많이 눌린 진입 항목입니다.
              </p>
              {topHeaderItems.length === 0 ? (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  아직 집계된 헤더 클릭 데이터가 없습니다.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {topHeaderItems.map((item, index) => {
                    const label =
                      (item.label && item.label.trim()) ||
                      (item.taxonomySlug && item.taxonomySlug.trim()) ||
                      item.key ||
                      "—";
                    return (
                      <li
                        key={`${item.key}-${index}`}
                        className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-2 last:border-0 last:pb-0"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-primary)]">
                          <span className="shrink-0 text-[11px] font-medium text-[var(--text-muted)]">
                            {index + 1}.
                          </span>
                          <span className="truncate">{label}</span>
                          {item.taxonomyType && (
                            <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                              {item.taxonomyType}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-[var(--text-secondary)]">
                          {Number(item.count).toLocaleString()}회
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </AdminCard>

            <AdminCard variant="glass" className="p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                상위 검색어
              </h3>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                사용자가 가장 자주 검색한 키워드입니다.
              </p>
              {topSearchKeywords.length === 0 ? (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  아직 집계된 검색어 데이터가 없습니다.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {topSearchKeywords.map((item, index) => (
                    <li
                      key={`${item.keyword}-${index}`}
                      className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-primary)]">
                        <span className="shrink-0 text-[11px] font-medium text-[var(--text-muted)]">
                          {index + 1}.
                        </span>
                        <span className="truncate">{item.keyword || "—"}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-[var(--text-secondary)]">
                        {Number(item.count).toLocaleString()}회
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          </section>

          <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4 backdrop-blur-md transition-colors">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">문의 상태 분포</h3>
              <p className="text-[11px] text-[var(--text-secondary)]">오늘 기준</p>
            </div>

            <div className="relative mt-4 h-40 w-full">
              <svg viewBox="0 0 100 40" className="h-full w-full">
                <defs>
                  <linearGradient id="inquiryArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* subtle grid */}
                <g stroke="var(--chart-grid)" strokeWidth="0.3" strokeOpacity="0.6">
                  {[10, 16, 22, 28, 34].map((y) => (
                    <line key={y} x1="0" y1={y} x2="100" y2={y} />
                  ))}
                </g>

                {counts &&
                  (() => {
                  const points = [
                    counts.completedInquiries,
                    counts.pendingInquiries,
                    counts.delayedInquiries,
                  ];
                  const max = Math.max(...points, 1);
                  const coords = points.map((value, index) => {
                    const x = (index / Math.max(points.length - 1, 1)) * 100;
                    const y = 35 - (value / max) * 25;
                    return { x, y };
                  });
                  const path =
                    coords.length > 0
                      ? coords
                          .map((point, index) =>
                            index === 0
                              ? `M ${point.x},${point.y}`
                              : `L ${point.x},${point.y}`,
                          )
                          .join(" ")
                      : "";
                  const area =
                    path !== ""
                      ? `${path} L 100,40 L 0,40 Z`
                      : "";

                  return (
                    <>
                      {area && (
                        <path d={area} fill="url(#inquiryArea)" stroke="none" />
                      )}
                      {path && (
                        <path
                          d={path}
                          fill="none"
                          stroke="var(--chart-1)"
                          strokeWidth={1.6}
                        />
                      )}
                      {/* points */}
                      {coords.map((point, index) => (
                        <circle
                          key={index}
                          cx={point.x}
                          cy={point.y}
                          r={1.4}
                          fill={
                            index === 0
                              ? "var(--chart-3)"
                              : index === 1
                              ? "var(--chart-1)"
                              : "var(--chart-5)"
                          }
                        />
                      ))}
                    </>
                  );
                })()}
              </svg>

            </div>

            {/* 차트 외부, 하단 요약 레전드 */}
            <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-[var(--text-secondary)]">
              {counts && (
                <>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[var(--chart-3)]" />
                    완료 {counts.completedInquiries}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" />
                    미처리 {counts.pendingInquiries}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[var(--chart-5)]" />
                    지연 {counts.delayedInquiries}
                  </span>
                </>
              )}
            </div>

          </section>
        </div>
      )}
    </div>
  );
}

