"use client";

import type { AdminAnalyticsOverview } from "@/lib/adminAnalytics";
import type { DashboardResponse } from "./useDashboardData";
import { DashboardMetricTile } from "./DashboardMetricTile";

type AdminDashboardAnalyticsSectionProps = {
  data: DashboardResponse | undefined;
  counts: DashboardResponse["counts"] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
};

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

export default function AdminDashboardAnalyticsSection({
  data,
  counts,
  isLoading,
  isError,
  onRefetch,
}: AdminDashboardAnalyticsSectionProps) {
  const analyticsSummary = getSafeAnalyticsSummary(data?.analytics);

  const isEmptyState = !isLoading && !isError && !counts;

  return (
    <div className="space-y-2 md:space-y-3">
      <p className="text-[11px] leading-snug text-[var(--text-muted)] md:text-xs">
        인기 검색·무결과·메가메뉴는 상단 &quot;검색·탐색 인사이트&quot;, 유입 퍼널은 &quot;전환 퍼널&quot;에서 확인할 수 있습니다.
      </p>

      {isLoading ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-[3.5rem] animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] md:h-[4rem]"
            />
          ))}
        </section>
      ) : isError || !data ? (
        <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4 text-sm text-[var(--text-primary)] backdrop-blur-md transition-colors md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-red-600">대시보드 지표를 불러오지 못했습니다.</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                네트워크 상태를 확인한 뒤 다시 시도해 주세요.
              </p>
            </div>
            <button type="button" onClick={() => onRefetch()} className="btn-admin-primary shrink-0 text-xs">
              다시 시도
            </button>
          </div>
        </section>
      ) : isEmptyState ? (
        <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4 text-sm text-[var(--text-primary)] backdrop-blur-md transition-colors md:p-6">
          <p className="font-semibold">아직 집계된 지표가 없습니다.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            데이터가 쌓이면 이 영역에서 주요 지표를 확인할 수 있습니다.
          </p>
        </section>
      ) : (
        <div className="flex flex-col space-y-3 md:space-y-4">
          <section>
            <h3 className="mb-2 text-xs font-semibold text-[var(--text-primary)] md:text-sm">탐색/전환 지표</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <DashboardMetricTile
                label="헤더·메뉴 클릭"
                value={analyticsSummary.headerNavClicks + analyticsSummary.megaMenuClicks}
                footnote="선택 기간"
              />
              <DashboardMetricTile label="검색 실행" value={analyticsSummary.searchSubmits} footnote="선택 기간" />
              <DashboardMetricTile
                label="검색 결과 클릭"
                value={analyticsSummary.searchResultClicks}
                footnote="선택 기간"
              />
              <DashboardMetricTile label="CTA 클릭" value={analyticsSummary.ctaClicks} footnote="선택 기간" />
              <DashboardMetricTile label="상품 카드 클릭" value={analyticsSummary.productCardClicks} footnote="선택 기간" />
            </div>
          </section>

          {counts ? (
            <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 backdrop-blur-md transition-colors md:p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">문의 상태 분포</h3>
                <p className="text-[11px] text-[var(--text-secondary)]">오늘 기준</p>
              </div>

              <div className="relative mt-3 h-36 w-full md:mt-4 md:h-40">
                <svg viewBox="0 0 100 40" className="h-full w-full">
                  <defs>
                    <linearGradient id="inquiryAreaDash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>

                  <g stroke="var(--chart-grid)" strokeWidth="0.3" strokeOpacity="0.6">
                    {[10, 16, 22, 28, 34].map((y) => (
                      <line key={y} x1="0" y1={y} x2="100" y2={y} />
                    ))}
                  </g>

                  {(() => {
                    const points = [counts.completedInquiries, counts.pendingInquiries, counts.delayedInquiries];
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
                              index === 0 ? `M ${point.x},${point.y}` : `L ${point.x},${point.y}`,
                            )
                            .join(" ")
                        : "";
                    const area = path !== "" ? `${path} L 100,40 L 0,40 Z` : "";

                    return (
                      <>
                        {area && <path d={area} fill="url(#inquiryAreaDash)" stroke="none" />}
                        {path && <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth={1.6} />}
                        {coords.map((point, index) => (
                          <circle
                            key={index}
                            cx={point.x}
                            cy={point.y}
                            r={1.4}
                            fill={
                              index === 0 ? "var(--chart-3)" : index === 1 ? "var(--chart-1)" : "var(--chart-5)"
                            }
                          />
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-[var(--text-secondary)] md:mt-3 md:gap-4">
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
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />
                  보류 {counts.onHoldInquiries ?? 0}
                </span>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
