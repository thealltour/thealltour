"use client";

import type { SeasonalPriceBands } from "@/types/product";
import { formatPriceKR } from "@/lib/pricing/calcQuote";

type SeasonalPriceComparisonProps = {
  bands: SeasonalPriceBands;
};

/**
 * PR-F: 구간가 비교 블록 (표시만, 가격 로직 변경 없음)
 */
export function SeasonalPriceComparison({ bands }: SeasonalPriceComparisonProps) {
  const cols = (
    [
      { key: "off", label: "비수기", n: bands.offSeason },
      { key: "we", label: "주말", n: bands.weekend },
      { key: "pk", label: "성수기", n: bands.peakSeason },
    ] as const
  ).filter(
    (x): x is (typeof x & { n: number }) =>
      typeof x.n === "number" && Number.isFinite(x.n) && x.n > 0,
  );

  if (cols.length === 0) return null;

  return (
    <div className="mt-3">
      <div
        className="hidden gap-3 md:grid"
        style={{
          gridTemplateColumns: `repeat(${Math.min(cols.length, 3)}, minmax(0, 1fr))`,
        }}
      >
        {cols.map((c) => {
          const digits = formatPriceKR(c.n);
          if (!digits) return null;
          return (
            <div
              key={c.key}
              className="rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2.5 ring-1 ring-slate-100"
            >
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className="font-price-strong mt-0.5 font-semibold tabular-nums text-[var(--primary)]">
                ₩{digits}~
              </p>
            </div>
          );
        })}
      </div>
      <div className="space-y-1.5 md:hidden">
        {cols.map((c) => {
          const digits = formatPriceKR(c.n);
          if (!digits) return null;
          return (
            <p
              key={c.key}
              className="font-price-strong text-lg font-bold leading-snug text-[var(--primary)]"
            >
              {c.label} 기준 ₩{digits}~
            </p>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        출발일 및 좌석 상황에 따라 가격이 변동됩니다. 정확한 요금은 상담 시 안내드립니다.
      </p>
    </div>
  );
}

/** PR-F: 추천 대상 고정 3줄 (운영 단순화) */
export function ProductDetailRecommendedAudience() {
  return (
    <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50 p-4 ring-1 ring-slate-100/80">
      <p className="mb-2 text-sm font-semibold text-slate-800">이런 분께 잘 맞아요</p>
      <ul className="space-y-1 text-sm leading-relaxed text-slate-600">
        <li>• 주말 중심 여행을 계획 중인 분</li>
        <li>• 비수기 가성비를 중요하게 보는 분</li>
        <li>• 상담으로 정확한 일정 안내를 받고 싶은 분</li>
      </ul>
    </div>
  );
}
