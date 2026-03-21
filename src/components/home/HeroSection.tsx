"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";
import { HeroRecommendedLinks } from "@/components/home/HeroRecommendedLinks";
import { HomeHeroSearch } from "@/components/home/HomeHeroSearch";
import { HomeQuickKeywords } from "@/components/home/HomeQuickKeywords";
import type { HomeBanner } from "@/types/homeBanner";

/** @deprecated Hero 모바일 칩용. 다른 화면에서 재사용 시에만 유지 */
export type HeroChipItem = { id: string; name: string; href: string };

export type HeroResolvedContent = {
  badge: string | null;
  main_copy_accent: string | null;
  main_copy_tail: string | null;
  sub_description: string | null;
  recommended_text: string | null;
  search_placeholder: string | null;
};

/** 모바일: 동일 DB 문구 기준으로 한 줄에 가까운 프리미엄 톤(데이터 필드 추가 없음). 긴 관용구만 짧게 치환. */
function MobileHeroHeadline({ hero }: { hero: HeroResolvedContent }): ReactNode {
  const accent = hero.main_copy_accent?.trim() ?? "";
  const tail = (hero.main_copy_tail ?? "").trim();
  if (!accent) {
    return <>{tail || "골프와 여행의 시작"}</>;
  }
  let shortTail = tail.replace(/^,+/, "").trim();
  if (/골프와 여행의 시작/.test(shortTail)) {
    shortTail = shortTail.replace(/골프와 여행의 시작/g, "골프·여행");
  }
  return (
    <>
      <span className="text-[var(--hero-accent)]">{accent}</span>
      {shortTail ? <span className="text-[var(--hero-text-primary)]"> {shortTail}</span> : null}
    </>
  );
}

export type HeroSectionProps = {
  /** 메인 비주얼 배너 (데스크탑만 사용, 모바일 Hero에서는 미노출) */
  primaryBanner?: HomeBanner | null;
  /** 히어로 문구 (resolveHeroContent 결과) */
  hero: HeroResolvedContent;
  /** 모바일 Hero 검색 아래 인기 여행지 칩 (모바일만 노출) */
  heroChipDestinations?: HeroChipItem[];
  /** 모바일 Hero 검색 아래 추천 테마 칩 (모바일만 노출) */
  heroChipThemes?: HeroChipItem[];
};

/**
 * 홈 최상단 Hero 섹션.
 * 모바일: 이미지 없이 텍스트 + 검색 + 빠른 선택 허브(아이콘 액션).
 * 데스크탑: 기존 비주얼 배너 + 문구 + 검색 + 추천 링크 텍스트 유지.
 */
export default function HeroSection({ primaryBanner = null, hero }: HeroSectionProps) {
  return (
    <section className="relative bg-[var(--hero-bg)]">
      {/* 데스크탑 전용: 배경 이미지 + 오버레이 (모바일에서는 렌더하지 않음) */}
      {primaryBanner ? (
        <>
          <div className="pointer-events-none absolute inset-0 hidden md:block">
            <Image
              src={primaryBanner.image_url}
              alt={primaryBanner.title}
              fill
              sizes="100vw"
              priority
              fetchPriority="high"
              quality={82}
              className="object-cover object-[right_center]"
            />
            <div className="absolute inset-0 hero-scrim" />
            <div className="absolute inset-y-0 right-0 w-3/5 hero-overlay-warm mix-blend-soft-light" />
            <div className="absolute inset-y-0 left-1/2 w-[18%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--hero-scrim-from)]/40 to-transparent backdrop-blur-[2px]" />
            <div className="absolute inset-0 hero-vignette" />
          </div>
          <div className="pointer-events-none absolute inset-0 hidden md:block hero-vignette-soft" />
        </>
      ) : null}

      <PageContainer
        size="wide"
        className="px-3 sm:px-6 lg:px-8 xl:px-10"
      >
        <div className="relative z-10 min-w-0 max-w-full py-2 text-[var(--hero-text-primary)] sm:py-4 md:py-10">
          <div className="min-w-0 space-y-1.5 md:space-y-5">
            {/* 모바일: Hero 이미지 카드 제거 — 이미지 블록 없음 */}

            <div className="grid min-w-0 max-w-full gap-1.5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)] md:items-center md:gap-6">
              <div className="flex min-w-0 max-w-full flex-col gap-1.5 md:space-y-4">
                <p className="section-label inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-[var(--hero-badge-bg)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--hero-text-secondary)] ring-1 ring-[var(--hero-badge-border)] sm:px-3 sm:py-1 sm:text-[11px] md:px-4 md:py-1 md:type-small">
                  {hero.badge ?? "THEALL TOUR"}
                </p>
                <h1 className="line-clamp-2 font-semibold leading-snug tracking-tight text-[var(--hero-text-primary)] text-lg sm:text-[1.65rem] sm:leading-tight md:line-clamp-none md:heading-display-hero md:type-h1 md:text-[2.5rem] md:leading-[1.15]">
                  <span className="md:hidden">
                    <MobileHeroHeadline hero={hero} />
                  </span>
                  <span className="hidden md:inline">
                    {hero.main_copy_accent ? (
                      <>
                        <span className="text-[var(--hero-accent)]">{hero.main_copy_accent}</span>
                        {hero.main_copy_tail}
                      </>
                    ) : (
                      hero.main_copy_tail?.trim() || "골프와 여행의 시작"
                    )}
                  </span>
                </h1>
                {hero.sub_description ? (
                  <p className="hidden max-w-xl md:block type-small font-semibold text-[var(--hero-text-secondary)] leading-snug md:type-body">
                    {hero.sub_description}
                  </p>
                ) : null}
                <div className="w-full min-w-0 max-w-[720px] space-y-0 md:space-y-1">
                  <div className="pt-0 md:pt-3">
                    <HomeHeroSearch
                      placeholder={hero.search_placeholder ?? "지역, 테마, 상품명을 검색해보세요"}
                      hideRecentSearchesOnMobile
                      variant="hero-mobile"
                    />
                  </div>
                  <HomeQuickKeywords />
                  {/* 데스크탑: 기존 추천 링크 텍스트 */}
                  <p className="hidden pt-1 type-caption text-[var(--hero-text-secondary)]/80 md:block">
                    {hero.recommended_text ? (
                      <HeroRecommendedLinks text={hero.recommended_text} />
                    ) : (
                      <>
                        또는{" "}
                        <Link href="/destinations" className="underline hover:no-underline">
                          지역별 여행
                        </Link>
                        {" · "}
                        <Link href="/themes" className="underline hover:no-underline">
                          테마별 여행
                        </Link>
                        {" · "}
                        <Link href="/recommended" className="underline hover:no-underline">
                          여행추천
                        </Link>
                        {" 으로 탐색"}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="hidden min-h-[160px] md:block" />
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
