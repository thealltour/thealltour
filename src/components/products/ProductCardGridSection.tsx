"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type ProductCardGridSectionProps = {
  /** 카드 목록 (보통 ProductCard 컴포넌트들). key는 각 카드에 부여해야 함. */
  children: React.ReactNode;
  className?: string;
  /** 데스크톱(lg) 그리드 열 수. 기본 3열. 랜딩 추천 상품 등 카드 폭을 넓히고 싶을 때 2로 설정 */
  desktopGridCols?: 2 | 3;
  /**
   * 홈 큐레이션 전용: 모바일에서 카드 폭·bleed·gap 축소(2장 인지 밀도).
   * 기본 false — 검색/랜딩/가이드 등은 기존 min-w-[78%] 유지.
   */
  homeCuratedMobileCompact?: boolean;
};

/**
 * 상품 카드 그리드·모바일 가로 스크롤 공통 래퍼.
 * - 모바일 기본: min-w-[78%] max-w-[320px], bleed -mx-1 px-1
 * - homeCuratedMobileCompact: 홈 추천 전용 — min-w-[47%] max-w-[200px], gap·bleed 축소
 * - 데스크톱: 그리드 2열(sm) / desktopGridCols(lg), max-w 1344px
 */
export function ProductCardGridSection({
  children,
  className,
  desktopGridCols = 3,
  homeCuratedMobileCompact = false,
}: ProductCardGridSectionProps) {
  const items = React.Children.toArray(children);

  if (items.length === 0) return null;

  const mobileTrackClass = homeCuratedMobileCompact
    ? "gap-2.5 -mx-5 px-5 sm:mx-0 sm:px-0"
    : "gap-3 -mx-1 px-1 sm:mx-0 sm:px-0";

  const mobileItemClass = homeCuratedMobileCompact
    ? "min-w-[47%] max-w-[200px] shrink-0"
    : "min-w-[78%] max-w-[320px] shrink-0";

  return (
    <div className={className}>
      <div className="mx-auto w-full max-w-[1344px]">
        {/* 모바일: 가로 스크롤 */}
        <div
          className={cn(
            "flex overflow-x-auto pb-2 scrollbar-hide sm:hidden",
            mobileTrackClass,
          )}
        >
          {items.map((item, i) => (
            <div key={i} className={mobileItemClass}>
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
