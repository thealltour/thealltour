"use client";

import Image from "next/image";
import type { ProductOverview } from "@/types/product";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

export type TravelOverviewProps = {
  /** [STEP 2] 오버뷰 jsonb (enabled일 때만 호출됨) */
  overview: ProductOverview;
  /** 커버 없을 때 fallback (product.image_url) */
  fallbackCoverUrl: string;
};

export function TravelOverview({ overview, fallbackCoverUrl }: TravelOverviewProps) {
  const cover = overview.coverImageUrl?.trim() || fallbackCoverUrl;
  const title = overview.title?.trim() || "여행 오버뷰";
  const summaryCards = overview.summaryCards ?? [];
  const chart = overview.chart;
  const timeline = overview.timeline;

  const hasSummaryCards = summaryCards.length > 0;
  const hasChart = chart?.enabled && (chart.items?.length ?? 0) > 0;
  const hasTimeline = timeline?.enabled && (timeline.days?.length ?? 0) > 0;

  return (
    <section className="space-y-4" aria-label={title}>
      {/* 커버 이미지 (coverImageUrl 없으면 product.image_url) */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-200">
        <Image
          src={normalizeProductImageUrl(cover) || "/thealltour-logo.png"}
          alt={title}
          fill
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="object-cover"
          priority
        />
      </div>

      {/* 요약 카드 그리드 */}
      {hasSummaryCards && (
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {summaryCards.map((card, i) => (
            <div
              key={`${card.kind}-${card.label}-${i}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 일정 테마 차트 */}
      {hasChart && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-800">일정 테마</h3>
          <div className="flex flex-wrap gap-3">
            {chart!.items.map((item, i) => (
              <div
                key={`${item.label}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
                <span className="text-xs font-semibold text-slate-500">{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 타임라인 요약 */}
      {hasTimeline && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-800">일정 요약</h3>
          <div className="space-y-2">
            {timeline!.days.map((d, i) => (
              <div
                key={`day-${d.day}-${i}`}
                className="flex gap-3 rounded-lg border-l-2 border-blue-400 bg-slate-50/50 px-3 py-2"
              >
                <span className="shrink-0 text-xs font-bold text-blue-700">
                  {d.day}일{d.dateText ? ` (${d.dateText})` : ""}
                </span>
                <div className="min-w-0 flex-1">
                  {d.headline && (
                    <p className="text-sm font-semibold text-slate-800">{d.headline}</p>
                  )}
                  <ul className="mt-0.5 space-y-0.5 text-sm text-slate-700">
                    {d.bullets.map((b, bi) => (
                      <li key={bi} className="list-inside list-disc">
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
