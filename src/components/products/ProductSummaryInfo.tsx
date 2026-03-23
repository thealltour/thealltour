"use client";

import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { InfoItem } from "@/components/products/detail/InfoItem";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type ProductSummaryInfoProps = {
  duration?: string;
  departure?: string;
  airline?: string;
  hotel?: string;
  travelStyle?: string;
  price?: number;
  minDeparturePeople?: string;
  includedSummary?: string;
  consultHref?: string;
  kakaoHref?: string;
  /** 있으면 문의하기 클릭 시 빠른 상담 모달 오픈 (consultHref는 모달 내 폼 기본 링크로 사용) */
  productId?: string;
  productTitle?: string;
  sourcePath?: string;
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
  consultHref,
  kakaoHref,
  productId,
  productTitle = "",
  sourcePath = "",
}: ProductSummaryInfoProps) {
  const { openModal } = useConsultModal();
  const hasAny =
    duration ||
    departure ||
    airline ||
    hotel ||
    travelStyle ||
    minDeparturePeople ||
    includedSummary ||
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
        {includedSummary ? (
          <InfoItem icon="included" label="포함사항" value={includedSummary} className="md:col-span-2" />
        ) : null}
      </div>

      {priceFormatted ? (
        <div className="border-t border-slate-200 pt-3">
          <InfoItem icon="price" label="가격" value={priceFormatted} />
        </div>
      ) : null}

      {(consultHref || kakaoHref || productId) && (
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row">
          {productId ? (
            <button
              type="button"
              onClick={() => openModal({ productId, productTitle, sourcePath })}
              className={cn(
                buttonVariants({ variant: "primary", size: "md" }),
                "flex-1 text-sm font-semibold",
              )}
              aria-label="일정 및 가격 문의하기"
            >
              일정/가격 문의하기
            </button>
          ) : consultHref ? (
            <a
              href={consultHref}
              className={cn(
                buttonVariants({ variant: "primary", size: "md" }),
                "flex-1 text-sm font-semibold",
              )}
              aria-label="일정 및 가격 문의하기"
            >
              일정/가격 문의하기
            </a>
          ) : null}
          {kakaoHref && (
            <a
              href={kakaoHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({
                  variant: "kakao",
                  size: "md",
                  className: "min-h-11 flex-1 text-sm font-semibold sm:flex-none",
                }),
              )}
              aria-label="카톡으로 상담하기"
            >
              카톡 상담
            </a>
          )}
        </div>
      )}
    </section>
  );
}
