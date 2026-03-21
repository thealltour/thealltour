"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";
import { HeroRecommendedLinks } from "@/components/home/HeroRecommendedLinks";
import { HomeHeroSearch } from "@/components/home/HomeHeroSearch";
import { HomeQuickKeywords } from "@/components/home/HomeQuickKeywords";
import type { HomeBanner } from "@/types/homeBanner";
import { cn } from "@/lib/cn";

/** 태블릿(md~lg 미만): mobile_image_url 우선, 없으면 PC 이미지 */
function bannerSrcForMidViewport(banner: HomeBanner): string {
  const m = banner.mobile_image_url?.trim();
  return m && m.length > 0 ? m : banner.image_url;
}

const SLIDE_INTERVAL_MS = 5000;

type HeroPanoramaSlideshowProps = {
  banners: HomeBanner[];
};

/**
 * 활성 배너 다중 장을 fade 전환. md~lg-1 / lg+ 각각 다른 소스(모바일 URL vs PC URL).
 * prefers-reduced-motion: 자동 전환 없음, 첫 장만 표시.
 */
function HeroPanoramaSlideshow({ banners }: HeroPanoramaSlideshowProps) {
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (banners.length <= 1 || reducedMotion) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % banners.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [banners.length, reducedMotion]);

  useEffect(() => {
    if (active >= banners.length) setActive(0);
  }, [banners.length, active]);

  const fadeClass = reducedMotion ? "transition-none" : "transition-opacity duration-700 ease-in-out";

  function renderStack(
    keyPrefix: string,
    getSrc: (b: HomeBanner) => string,
    wrapperClass: string,
    objectPositionClass: string,
  ) {
    return (
      <div className={cn("absolute inset-0", wrapperClass)}>
        {banners.map((banner, i) => (
          <div
            key={`${keyPrefix}-${banner.id}`}
            className={cn("absolute inset-0", fadeClass)}
            style={{
              opacity: i === active ? 1 : 0,
              zIndex: i === active ? 1 : 0,
            }}
            aria-hidden={i !== active}
          >
            <Image
              src={getSrc(banner)}
              alt={banner.title}
              fill
              sizes="100vw"
              priority={i === 0}
              fetchPriority={i === 0 ? "high" : "auto"}
              quality={82}
              className={cn("object-cover", objectPositionClass)}
              loading={i === 0 ? undefined : "lazy"}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {renderStack(
        "mid",
        bannerSrcForMidViewport,
        "md:block lg:hidden",
        "object-center",
      )}
      {renderStack(
        "lg",
        (b) => b.image_url,
        "hidden lg:block",
        "object-[right_center]",
      )}
    </>
  );
}

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
  /**
   * 활성 배너 전부 (`getHomeBanners` 정렬 순). 0장이면 배경 없음, 1장이면 단일, 2장+ fade 슬라이드.
   */
  heroBanners?: HomeBanner[];
  /** 히어로 문구 (resolveHeroContent 결과) */
  hero: HeroResolvedContent;
  /** 모바일 Hero 검색 아래 인기 여행지 칩 (모바일만 노출) */
  heroChipDestinations?: HeroChipItem[];
  /** 모바일 Hero 검색 아래 추천 테마 칩 (모바일만 노출) */
  heroChipThemes?: HeroChipItem[];
};

/**
 * 홈 최상단 Hero 섹션.
 * 모바일(&lt;md): 배너 배경 없음 — 텍스트 + 검색 + 빠른 선택 허브.
 * md+: 파노라마 배경 — `heroBanners`를 sort_order 순으로 fade 슬라이드(2장 이상 시).
 * 태블릿(md~lg-1): `mobile_image_url ?? image_url`, 데스크톱(lg+): `image_url`.
 */
export default function HeroSection({ heroBanners = [], hero }: HeroSectionProps) {
  const hasBanners = heroBanners.length > 0;

  return (
    <section className="relative overflow-hidden bg-[var(--hero-bg)] max-md:border-b max-md:border-slate-200/90 max-md:shadow-[inset_0_-1px_0_rgba(255,255,255,0.65)]">
      {/* 모바일 전용: 소프트 그라데이션 + 은은한 브랜드 글로우 (globals `.hero-mobile-atmosphere`) */}
      <div className="pointer-events-none absolute inset-0 z-0 md:hidden" aria-hidden>
        <div className="hero-mobile-atmosphere" />
      </div>

      {/* md+ 전용: 배경 슬라이드 + 공통 오버레이 (모바일만 미노출). link_url·클릭은 미연결(pointer-events-none). */}
      {hasBanners ? (
        <>
          <div className="pointer-events-none absolute inset-0 hidden md:block">
            <HeroPanoramaSlideshow banners={heroBanners} />
            <div className="absolute inset-0 z-[2] hero-scrim" />
            <div className="absolute inset-y-0 right-0 z-[2] w-3/5 hero-overlay-warm mix-blend-soft-light" />
            <div className="absolute inset-y-0 left-1/2 z-[2] w-[18%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--hero-scrim-veil-mid)] to-transparent backdrop-blur-[2px]" />
            <div className="absolute inset-0 z-[2] hero-vignette" />
          </div>
          <div className="pointer-events-none absolute inset-0 z-[3] hidden md:block hero-vignette-soft" />
        </>
      ) : null}

      <PageContainer
        size="wide"
        className="px-3 sm:px-6 lg:px-8 xl:px-10"
      >
        <div className="relative z-10 min-w-0 max-w-full pt-2 pb-7 text-[var(--hero-text-primary)] sm:pt-4 sm:pb-6 md:py-7 lg:py-10">
          <div className="min-w-0 space-y-1.5 md:space-y-4 lg:space-y-5">
            <div className="grid min-w-0 max-w-full gap-1.5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)] lg:items-center lg:gap-6">
              <div className="flex w-full min-w-0 max-w-full flex-col gap-2 max-md:gap-2.5 md:mx-auto md:max-w-[560px] md:gap-3 lg:mx-0 lg:max-w-[720px] lg:gap-4">
                <h1 className="line-clamp-2 font-semibold leading-snug tracking-tight text-[var(--hero-text-primary)] text-[1.4rem] sm:text-[2.06rem] sm:leading-tight md:line-clamp-none md:heading-display-hero md:text-[2.5rem] md:leading-[1.2] lg:type-h1 lg:text-[3.125rem] lg:leading-[1.15]">
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
                  <p className="hidden w-full max-w-[32rem] md:block type-small font-semibold text-[var(--hero-text-secondary)] leading-snug md:type-body lg:max-w-xl">
                    {hero.sub_description}
                  </p>
                ) : null}
                <div className="flex w-full min-w-0 flex-col max-md:gap-5 md:gap-1">
                  <div className="relative z-[1] pt-0 md:pt-2 lg:pt-3">
                    <HomeHeroSearch
                      placeholder={hero.search_placeholder ?? "지역, 테마, 상품명을 검색해보세요"}
                      variant="hero-mobile"
                    />
                  </div>
                  <div className="relative z-0 max-md:opacity-[0.96]">
                    <HomeQuickKeywords />
                  </div>
                  <p className="hidden pt-1 type-caption text-[var(--hero-text-secondary)]/80 lg:block">
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
              <div className="hidden min-h-[160px] lg:block" />
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
