"use client";

import * as React from "react";

export type ProductCardGridSectionProps = {
  /** 카드 목록 (보통 ProductCard 컴포넌트들). key는 각 카드에 부여해야 함. */
  children: React.ReactNode;
  className?: string;
};

/**
 * /recommended와 동일한 상품 카드 노출 방식.
 * - 모바일: 가로 스크롤 (카드당 min-w-[78%] max-w-[320px])
 * - 데스크톱: 그리드 2열(sm) / 3열(lg), 최대 너비 1344px
 * 메인 홈 추천, /recommended, 검색 결과, 랜딩, 가이드 관련 상품 등에서 공통 사용.
 */
export function ProductCardGridSection({
  children,
  className,
}: ProductCardGridSectionProps) {
  const items = React.Children.toArray(children);

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <div className="mx-auto w-full max-w-[1344px]">
        {/* 모바일: 가로 스크롤 */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 sm:hidden">
          {items.map((item, i) => (
            <div
              key={i}
              className="min-w-[78%] max-w-[320px] shrink-0"
            >
              {item}
            </div>
          ))}
        </div>
        {/* 데스크톱: 그리드 2열 → 3열 */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {items}
        </div>
      </div>
    </div>
  );
}
