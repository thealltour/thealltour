"use client";

import type { IconName } from "@/icons";
import type { TravelOverviewModel } from "@/lib/products/mapProductToOverview";
import { ThemeChartCard } from "@/components/products/ThemeChartCard";
import { FlightSummarySection } from "@/components/products/FlightSummarySection";
import { InfoItem } from "@/components/products/detail/InfoItem";
import type { Product } from "@/types/product";

/** 오버뷰 요약 카드 → 브랜드 레지스트리 */
const BRAND_CARD_ICONS: Partial<Record<string, IconName>> = {
  flight: "flight",
  hotel: "hotel",
  region: "region",
  golf: "golf",
  etc: "calendar",
};

export type TravelOverviewV2Props = {
  /** 모델이 없거나 카드가 없으면 렌더하지 않음 */
  model: TravelOverviewModel | null;
  /** 항공 카드 포함용 상품 데이터 */
  product?: Product | null;
  /** 모바일에서만 오버뷰에 차트 표시 등 (기존과 동일) */
  onGoToItinerary?: () => void;
};

export function TravelOverviewV2({
  model,
  product = null,
  onGoToItinerary: _onGoToItinerary,
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
      <div className="p-5 md:p-7">
        <div className="mb-4">
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)] md:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-content-muted">{subtext}</p>
        </div>

        <div className="space-y-6">
          <div
            className={
              hasChart
                ? "grid grid-cols-1 gap-4"
                : "block"
            }
          >
            {hasChart && (
              <div className="md:hidden">
                <ThemeChartCard items={chart!.items} />
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-2.5 sm:grid sm:grid-cols-3 sm:gap-3 sm:space-y-0">
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

function iconForCard(iconKey: string): IconName {
  const mapped = BRAND_CARD_ICONS[iconKey];
  if (mapped) return mapped;
  if (iconKey === "theme") return "sparkles";
  return "moreHorizontal";
}

function SummaryCard({ card }: { card: CardModel }) {
  const displayValue = card.value?.trim() || "상담 시 안내";
  const icon = iconForCard(card.iconKey);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition hover:shadow-[var(--shadow-soft-strong)]">
      <InfoItem icon={icon} label={card.label} value={displayValue} />
    </div>
  );
}
