"use client";

import {
  Plane,
  Building2,
  MapPin,
  Sparkles,
  CircleDot,
  MoreHorizontal,
} from "lucide-react";
import type { TravelOverviewModel } from "@/lib/products/mapProductToOverview";
import { ThemeChartCard } from "@/components/products/ThemeChartCard";
import { FlightSummarySection } from "@/components/products/FlightSummarySection";
import type { Product } from "@/types/product";

const CARD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: Building2,
  region: MapPin,
  theme: Sparkles,
  golf: CircleDot,
  etc: MoreHorizontal,
};

export type TravelOverviewV2Props = {
  /** 모델이 없거나 카드가 없으면 렌더하지 않음 */
  model: TravelOverviewModel | null;
  /** 항공 카드 포함용 상품 데이터 */
  product?: Product | null;
  /** 일정 타임라인은 오버뷰 아래 InteractiveTimelineV2에서 표시 (onGoToItinerary는 해당 섹션으로 스크롤용) */
  onGoToItinerary?: () => void;
};

export function TravelOverviewV2({
  model,
  product = null,
}: TravelOverviewV2Props) {
  if (!model || !model.cards?.length) {
    return null;
  }

  const title = model.title?.trim() || "여행 오버뷰";
  const subtext = "여행 일정과 흐름을 한눈에 확인하세요.";
  const cards = model.cards.slice(0, 3);
  const chart = model.chart;

  const hasChart = chart?.items?.length ? chart.items.length > 0 : false;

  return (
    <section
      className="w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft-strong)]"
      aria-label={title}
    >
      <div className="p-6 md:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)] md:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{subtext}</p>
        </div>

        <div className="space-y-8">
          {/* 1. 차트 (모바일에서만 오버뷰에 표시, 웹은 오른쪽 예상가 위에 표시) */}
          <div
            className={
              hasChart
                ? "grid grid-cols-1 gap-6"
                : "block"
            }
          >
            {/* 차트 (도넛) - 모바일에서만 오버뷰에 표시 */}
            {hasChart && (
              <div className="md:hidden">
                <ThemeChartCard items={chart!.items} />
              </div>
            )}
          </div>

          {/* 2. 항공·숙소·지역 카드 */}
          <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3">
            {cards.map((card, i) => (
              <SummaryCard key={`${card.iconKey}-${card.label}-${i}`} card={card} />
            ))}
          </div>

          <FlightSummarySection product={product} compact embedded />

        </div>
      </div>
    </section>
  );
}

type CardModel = { iconKey: string; label: string; value: string };

function SummaryCard({ card }: { card: CardModel }) {
  const Icon = CARD_ICONS[card.iconKey] ?? MoreHorizontal;
  const displayValue = card.value?.trim() || "상담 시 안내";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition hover:shadow-[var(--shadow-soft-strong)]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:color-mix(in_oklab,var(--primary)_12%,white)] text-[var(--primary)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{card.label}</p>
        <p className="mt-0.5 line-clamp-2 break-words text-sm font-semibold text-[var(--text-primary)]">{displayValue}</p>
      </div>
    </div>
  );
}

