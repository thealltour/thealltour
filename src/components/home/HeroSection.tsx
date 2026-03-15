"use client";

import Link from "next/link";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";
import { HeroRecommendedLinks } from "@/components/home/HeroRecommendedLinks";
import { HomeHeroSearch } from "@/components/home/HomeHeroSearch";
import type { HomeBanner } from "@/types/homeBanner";

export type HeroChipItem = { id: string; name: string; href: string };

export type HeroResolvedContent = {
  badge: string | null;
  main_copy_accent: string | null;
  main_copy_tail: string | null;
  sub_description: string | null;
  recommended_text: string | null;
  search_placeholder: string | null;
};

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
 * 모바일: 이미지 없이 텍스트 + 검색 + 인기 여행지/추천 테마 칩.
 * 데스크탑: 기존 비주얼 배너 + 문구 + 검색 + 추천 링크 텍스트 유지.
 */
export default function HeroSection({
  primaryBanner = null,
  hero,
  heroChipDestinations = [],
  heroChipThemes = [],
}: HeroSectionProps) {
  const hasChips = heroChipDestinations.length > 0 || heroChipThemes.length > 0;

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

      <PageContainer size="wide">
        <div className="relative z-10 py-4 text-[var(--hero-text-primary)] sm:py-6 md:py-10">
          <div className="space-y-4 md:space-y-5">
            {/* 모바일: Hero 이미지 카드 제거 — 이미지 블록 없음 */}

            <div className="grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)] md:items-center md:gap-6">
              <div className="space-y-3 md:space-y-4">
                <p className="inline-flex items-center gap-2 rounded-full bg-[var(--hero-badge-bg)] px-3 py-1 section-label text-[var(--hero-text-secondary)] ring-1 ring-[var(--hero-badge-border)] md:px-4 md:type-small">
                  {hero.badge ?? "THEALL TOUR"}
                </p>
                <h1 className="heading-display-hero type-h1 font-semibold leading-[1.15] md:text-[2.5rem]">
                  {hero.main_copy_accent ? (
                    <>
                      <span className="text-[var(--hero-accent)]">{hero.main_copy_accent}</span>
                      {hero.main_copy_tail}
                    </>
                  ) : (
                    hero.main_copy_tail?.trim() || "골프와 여행의 시작"
                  )}
                </h1>
                <p className="max-w-xl type-small font-semibold text-[var(--hero-text-secondary)] leading-snug md:type-body">
                  {hero.sub_description ?? ""}
                </p>
                <div className="w-full max-w-[720px] space-y-1">
                  <div className="pt-1 md:pt-3">
                    <HomeHeroSearch
                      placeholder={hero.search_placeholder ?? "지역, 테마, 상품명을 검색해보세요"}
                      hideRecentSearchesOnMobile
                      variant="hero-mobile"
                    />
                  </div>
                  {/* 모바일: 인기 여행지 / 추천 테마 칩 (검색 바로 아래) */}
                  {hasChips ? (
                    <div className="flex flex-col gap-3 pt-2 md:hidden">
                      {heroChipDestinations.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="section-label text-[11px] font-medium text-[var(--hero-text-secondary)]/90">
                            인기 여행지
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {heroChipDestinations.map((item) => (
                              <Link
                                key={item.id}
                                href={item.href}
                                className="inline-flex items-center rounded-full border border-[var(--hero-badge-border)] bg-[var(--hero-badge-bg)] px-3 py-1.5 text-xs font-medium text-[var(--hero-text-primary)] transition hover:bg-[var(--hero-badge-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:opacity-90"
                              >
                                {item.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {heroChipThemes.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="section-label text-[11px] font-medium text-[var(--hero-text-secondary)]/90">
                            추천 테마
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {heroChipThemes.map((item) => (
                              <Link
                                key={item.id}
                                href={item.href}
                                className="inline-flex items-center rounded-full border border-[var(--hero-badge-border)] bg-[var(--hero-badge-bg)] px-3 py-1.5 text-xs font-medium text-[var(--hero-text-primary)] transition hover:bg-[var(--hero-badge-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:opacity-90"
                              >
                                {item.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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
