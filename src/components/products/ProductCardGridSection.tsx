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
  /**
   * /destinations, /themes 허브 추천 상품: md 미만만 가로 레일 + scroll-snap + PageContainer bleed,
   * md 이상부터 그리드(태블릿 세로 나열 방지).
   */
  hubLandingLayout?: boolean;
};

/**
 * 상품 카드 그리드·모바일 가로 스크롤 공통 래퍼.
 * - 모바일 기본: min-w-[78%] max-w-[320px], bleed -mx-1 px-1
 * - homeCuratedMobileCompact: 홈 추천 전용 — 모바일 `grid-cols-2` 고정(가로 스크롤 없음), gap·bleed 정리
 * - hubLandingLayout: 스냅 레일 + 78~84% 카드 폭, md+ 그리드
 * - 데스크톱: 그리드 2열(sm 또는 md) / desktopGridCols(lg), max-w 1344px
 */
export function ProductCardGridSection({
  children,
  className,
  desktopGridCols = 3,
  homeCuratedMobileCompact = false,
  hubLandingLayout = false,
}: ProductCardGridSectionProps) {
  const items = React.Children.toArray(children);

  if (items.length === 0) return null;

  const mobileBleedClass = homeCuratedMobileCompact
    ? "-mx-4 px-4 sm:mx-0 sm:px-0"
    : hubLandingLayout
      ? "-mx-4 px-4 md:mx-0 md:px-0"
      : "-mx-1 px-1 sm:mx-0 sm:px-0";

  const mobileItemClass = homeCuratedMobileCompact
    ? "min-w-0"
    : hubLandingLayout
      ? "min-w-[78%] max-w-[84%] shrink-0 snap-start"
      : "min-w-[78%] max-w-[320px] shrink-0";

  const mobileRailHidden = hubLandingLayout ? "md:hidden" : "sm:hidden";

  const desktopGridClass =
    desktopGridCols === 2
      ? hubLandingLayout
        ? "hidden md:grid md:grid-cols-2 lg:grid-cols-2 md:gap-4"
        : "hidden sm:grid sm:grid-cols-2 lg:grid-cols-2 sm:gap-4"
      : hubLandingLayout
        ? "hidden md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4"
        : "hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4";

  return (
    <div className={className}>
      <div className="mx-auto w-full max-w-[1344px]">
        {/* 모바일: 홈 큐레이션은 2열 그리드 / 그 외는 가로 스크롤 */}
        {homeCuratedMobileCompact ? (
          <div
            className={cn(
              "grid grid-cols-2 gap-x-2 gap-y-2.5 pb-2 sm:hidden",
              mobileBleedClass,
            )}
          >
            {items.map((item, i) => (
              <div key={i} className={mobileItemClass}>
                {item}
              </div>
            ))}
          </div>
        ) : (
          <div
            className={cn(
              "flex overflow-x-auto pb-2 scrollbar-hide",
              hubLandingLayout && "snap-x snap-mandatory scroll-smooth [touch-action:pan-x]",
              hubLandingLayout ? "gap-4" : "gap-3",
              mobileRailHidden,
              mobileBleedClass,
            )}
          >
            {items.map((item, i) => (
              <div key={i} className={mobileItemClass}>
                {item}
              </div>
            ))}
          </div>
        )}
        {/* 데스크톱: 그리드 */}
        <div className={desktopGridClass}>{items}</div>
      </div>
    </div>
  );
}
