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
  const hasAny =
    duration ||
    departure ||
    airline ||
    hotel ||
    travelStyle ||
    minDeparturePeople ||
    includedSummary ||
    excludedSummary ||
    usePriceHeroGuide ||
    (typeof price === "number" && price > 0);
  if (!hasAny) return null;

  const priceFormatted =
    typeof price === "number" && price > 0 ? (
      <span className="text-base font-semibold tracking-tight">{price.toLocaleString()}원~</span>
    ) : undefined;

  return (
    <section
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 ring-1 ring-slate-100/50"
      aria-label="상품 핵심 요약"
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 md:grid-cols-2">
        {duration ? <InfoItem icon="calendar" label="여행기간" value={duration} /> : null}
        {departure ? <InfoItem icon="region" label="출발지역" value={departure} /> : null}
        {airline ? <InfoItem icon="flight" label="항공" value={airline} /> : null}
        {hotel ? <InfoItem icon="hotel" label="숙소" value={hotel} /> : null}
        {travelStyle ? <InfoItem icon="compass" label="여행스타일" value={travelStyle} /> : null}
        {minDeparturePeople ? (
          <InfoItem icon="users" label="출발인원" value={minDeparturePeople} />
        ) : null}
        {(includedSummary || excludedSummary) && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 md:col-span-2 md:grid-cols-2">
            <div className="min-w-0">
              {includedSummary ? (
                <InfoItem icon="included" label="포함사항" value={includedSummary} />
              ) : null}
            </div>
            <div className="min-w-0">
              {excludedSummary ? (
                <InfoItem icon="xCircle" label="불포함사항" value={excludedSummary} />
              ) : null}
            </div>
          </div>
        )}
      </div>

      {usePriceHeroGuide ? (
        <div className="border-t border-slate-200 pt-3">
          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            <InfoItem
              icon="price"
              label="가격"
              value={
                <span className="text-base leading-relaxed text-slate-600">
                  상단 &quot;대표 출발가 안내&quot;와 동일한 기준입니다. 정확한 요금은 상담을 통해 안내드립니다.
                </span>
              }
            />
          </div>
        </div>
      ) : priceFormatted ? (
        <div className="border-t border-slate-200 pt-3">
          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            <InfoItem icon="price" label="가격" value={priceFormatted} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
