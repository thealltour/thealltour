"use client";

import Link from "next/link";

type InquirySuccessPanelProps = {
  slaMinutes?: number;
  kakaoHref?: string;
  className?: string;
};

export function InquirySuccessPanel({
  slaMinutes = 30,
  kakaoHref,
  className = "",
}: InquirySuccessPanelProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-sm font-medium text-emerald-800">
        영업시간 기준 약 {slaMinutes}분 내 순차 연락드립니다.
      </p>
      <div className="flex flex-wrap items-center gap-2 type-caption">
        {kakaoHref ? (
          <a
            href={kakaoHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border border-emerald-200 bg-white px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            카카오 채널에서 빠른 상담
          </a>
        ) : null}
        <Link
          href="/products"
          className="inline-flex items-center rounded-md border border-emerald-200 bg-white px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          다른 상품 더 보기
        </Link>
        <Link
          href="/support"
          className="inline-flex items-center rounded-md border border-emerald-200 bg-white px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          고객센터 바로가기
        </Link>
      </div>
    </div>
  );
}
