"use client";

import {
  Clock,
  MapPin,
  Plane,
  Hotel,
  Compass,
  Users,
  CheckCircle,
} from "lucide-react";
import { useConsultModal } from "@/components/ConsultModal";

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

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 ring-1 ring-slate-100/50 space-y-5"
      aria-label="상품 핵심 요약"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
        {duration && (
          <div className="flex items-start gap-3">
            <Clock aria-hidden className="mt-[2px] h-4 w-4 shrink-0 text-slate-400" />
            <span className="w-20 shrink-0 font-normal text-slate-500 md:w-24">여행기간</span>
            <span className="min-w-0 font-medium text-slate-900 break-words">{duration}</span>
          </div>
        )}

        {departure && (
          <div className="flex items-start gap-3">
            <MapPin aria-hidden className="mt-[2px] h-4 w-4 shrink-0 text-slate-400" />
            <span className="w-20 shrink-0 font-normal text-slate-500 md:w-24">출발지역</span>
            <span className="min-w-0 font-medium text-slate-900 break-words">{departure}</span>
          </div>
        )}

        {airline && (
          <div className="flex items-start gap-3">
            <Plane aria-hidden className="mt-[2px] h-4 w-4 shrink-0 text-slate-400" />
            <span className="w-20 shrink-0 font-normal text-slate-500 md:w-24">항공</span>
            <span className="min-w-0 font-medium text-slate-900 break-words">{airline}</span>
          </div>
        )}

        {hotel && (
          <div className="flex items-start gap-3">
            <Hotel aria-hidden className="mt-[2px] h-4 w-4 shrink-0 text-slate-400" />
            <span className="w-20 shrink-0 font-normal text-slate-500 md:w-24">숙소</span>
            <span className="min-w-0 font-medium text-slate-900 break-words">{hotel}</span>
          </div>
        )}

        {travelStyle && (
          <div className="flex items-start gap-3">
            <Compass aria-hidden className="mt-[2px] h-4 w-4 shrink-0 text-slate-400" />
            <span className="w-20 shrink-0 font-normal text-slate-500 md:w-24">여행스타일</span>
            <span className="min-w-0 font-medium text-slate-900 break-words">{travelStyle}</span>
          </div>
        )}

        {minDeparturePeople && (
          <div className="flex items-start gap-3">
            <Users aria-hidden className="mt-[2px] h-4 w-4 shrink-0 text-slate-400" />
            <span className="w-20 shrink-0 font-normal text-slate-500 md:w-24">출발인원</span>
            <span className="min-w-0 font-medium text-slate-900 break-words">{minDeparturePeople}</span>
          </div>
        )}

        {includedSummary && (
          <div className="flex items-start gap-3">
            <CheckCircle aria-hidden className="mt-[2px] h-4 w-4 shrink-0 text-slate-400" />
            <span className="w-20 shrink-0 font-normal text-slate-500 md:w-24">포함사항</span>
            <span className="min-w-0 font-medium text-slate-900 line-clamp-2">{includedSummary}</span>
          </div>
        )}
      </div>

      {typeof price === "number" && price > 0 && (
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <span className="text-sm font-normal text-slate-500">가격</span>
          <span className="text-xl font-semibold tracking-tight text-slate-900">
            {price.toLocaleString()}원~
          </span>
        </div>
      )}

      {(consultHref || kakaoHref || productId) && (
        <div className="pt-4 flex flex-col gap-2 sm:flex-row">
          {productId ? (
            <button
              type="button"
              onClick={() => openModal({ productId, productTitle, sourcePath })}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              aria-label="상품 문의하기"
            >
              문의하기
            </button>
          ) : consultHref ? (
            <a
              href={consultHref}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              aria-label="상품 문의하기"
            >
              문의하기
            </a>
          ) : null}
          {kakaoHref && (
            <a
              href={kakaoHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              aria-label="카카오톡으로 상담하기"
            >
              카카오 상담
            </a>
          )}
        </div>
      )}
    </section>
  );
}
