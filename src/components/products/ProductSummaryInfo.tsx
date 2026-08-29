"use client";

import { InfoItem } from "@/components/products/detail/InfoItem";

type ProductSummaryInfoProps = {
  duration?: string;
  departure?: string;
  airline?: string;
  hotel?: string;
  travelStyle?: string;
  price?: number;
  minDeparturePeople?: string;
  includedSummary?: string;
  excludedSummary?: string;
  /** true면 숫자 가격 대신 상단 대표 출발가 안내 참고 문구 */
  usePriceHeroGuide?: boolean;
};

export default function ProductSummaryInfo({
  duration,
  departure,
  airline,
  hotel,
  travelStyle,
  price,
  minDeparturePeople,
  includedSummary,
  excludedSummary,
  usePriceHeroGuide = false,
}: ProductSummaryInfoProps) {
  // 사실 정보만 (가격·포함/불포함은 Detail의 Price Card / Cost Summary에서 담당)
  const hasAny = duration || departure || airline || hotel || travelStyle || minDeparturePeople;
  if (!hasAny) return null;

  void price;
  void includedSummary;
  void excludedSummary;
  void usePriceHeroGuide;

  return (
    <section
      className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      aria-label="여행 핵심 정보"
    >
      <h2 className="text-sm font-bold text-[var(--text-primary)]">여행 핵심 정보</h2>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {duration ? <InfoItem icon="calendar" label="여행기간" value={duration} /> : null}
        {departure ? <InfoItem icon="region" label="출발지역" value={departure} /> : null}
        {airline ? <InfoItem icon="flight" label="항공" value={airline} /> : null}
        {hotel ? <InfoItem icon="hotel" label="숙소" value={hotel} /> : null}
        {travelStyle ? <InfoItem icon="compass" label="여행스타일" value={travelStyle} /> : null}
        {minDeparturePeople ? (
          <InfoItem icon="users" label="출발인원" value={minDeparturePeople} />
        ) : null}
      </div>
    </section>
  );
}
