"use client";

import * as React from "react";

export type ProductCardGridSectionProps = {
  /** 카드 목록 (보통 ProductCard 컴포넌트들). key는 각 카드에 부여해야 함. */
  children: React.ReactNode;
  className?: string;
  /** 데스크톱(lg) 그리드 열 수. 기본 3열. 랜딩 추천 상품 등 카드 폭을 넓히고 싶을 때 2로 설정 */
  desktopGridCols?: 2 | 3;
};

/**
 * /recommended와 동일한 상품 카드 노출 방식.
 * - 모바일: 가로 스크롤 (카드당 min-w-[78%] max-w-[320px])
 * - 데스크톱: 그리드 2열(sm) / 2열 또는 3열(lg, desktopGridCols prop), 최대 너비 1344px
 * 메인 홈 추천, /recommended, 검색 결과, 랜딩, 가이드 관련 상품 등에서 공통 사용.
 * 랜딩 추천 상품은 desktopGridCols={2}로 2열 사용.
 */
export function ProductCardGridSection({
  children,
  className,
  desktopGridCols = 3,
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
        {/* 데스크톱: 그리드 2열(sm) / desktopGridCols열(lg). 랜딩 추천은 2열로 카드 폭 확대 */}
        <div
          className={
            desktopGridCols === 2
              ? "hidden sm:grid sm:grid-cols-2 lg:grid-cols-2 sm:gap-4"
              : "hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4"
          }
        >
          {items}
        </div>
      </div>
    </div>
  );
}
