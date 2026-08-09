import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";
import { HeroRecommendedLinks } from "@/components/home/HeroRecommendedLinks";
import { HomeHeroSearch } from "@/components/home/HomeHeroSearch";
import { HomeQuickKeywords } from "@/components/home/HomeQuickKeywords";
import type { HomeBanner } from "@/types/homeBanner";
import { cn } from "@/lib/cn";
import { HeroPanoramaSlideshowClient } from "@/components/home/HeroPanoramaSlideshowClient";

/** 태블릿(md~lg 미만): mobile_image_url 우선, 없으면 PC 이미지 */
function bannerSrcForMidViewport(banner: HomeBanner): string {
  const m = banner.mobile_image_url?.trim();
  return m && m.length > 0 ? m : banner.image_url;
}

/** PageContainer `wide`와 동일 — 파노라마·srcset이 뷰포트 전체로 불필요 확대되지 않도록 */
const HERO_PANORAMA_MAX_WIDTH_PX = 1600;

/** md+ 파노라마 박스 높이(명시 필수: 자식이 absolute fill이라 max-h만으로는 높이 0) — 과도한 세로 확대 완화 */
const HERO_PANORAMA_HEIGHT_CLASS = "min-h-[260px] h-[min(52vh,560px)]";

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
  const firstBanner = heroBanners[0] ?? null;

  return (
    <section
      className={cn(
        "relative w-full",
        /* md+: 본문 PageContainer와 동일 거터 — 둥근 히어로가 섹션 래퍼와 폭 정렬 */
        "md:mx-auto md:max-w-[1600px] md:px-6 lg:px-8 xl:px-10",
        "max-md:border-b max-md:border-slate-200/90 max-md:shadow-[inset_0_-1px_0_rgba(255,255,255,0.65)]",
      )}
    >
      <div
        className={cn(
          "relative bg-[var(--hero-bg)]",
          /* SectionBlock·상품카드와 동일 계열 라운드 (md+ 배경 사진에만 적용) */
          "md:rounded-2xl lg:rounded-3xl",
        )}
      >
        {/*
          배경 전용 레이어. overflow-hidden·라운드는 이 안에서만 적용해
          검색창 아래 추천 검색어 드롭다운(하위 PageContainer)이 잘리지 않도록 함.
        */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-0 overflow-hidden",
            "md:rounded-2xl lg:rounded-3xl",
          )}
          aria-hidden
        >
          {/* 모바일 전용: 소프트 그라데이션 + 은은한 브랜드 글로우 (globals `.hero-mobile-atmosphere`) */}
          <div className="absolute inset-0 z-0 md:hidden">
            <div className="hero-mobile-atmosphere" />
          </div>

          {/* md+ 전용: 배경 슬라이드 + 공통 오버레이 (모바일만 미노출). link_url·클릭은 미연결(pointer-events-none). */}
          {hasBanners ? (
            <>
              {/*
                파노라마는 라운드 래퍼 안에서만 object-cover.
                스크림은 섹션 전체 높이를 덮어 하단 콘텐츠 가독성 유지.
              */}
              <div
                className={cn(
                  "absolute inset-x-0 top-0 z-0 hidden md:block",
                  "w-full",
                  HERO_PANORAMA_HEIGHT_CLASS,
                  "overflow-hidden",
                )}
              >
                {heroBanners.length > 1 ? (
                  <HeroPanoramaSlideshowClient banners={heroBanners} />
                ) : firstBanner ? (
                  <>
                    <div className="absolute inset-0 md:block lg:hidden">
                      <Image
                        src={bannerSrcForMidViewport(firstBanner)}
                        alt={firstBanner.title}
                        fill
                        sizes={`(max-width: ${HERO_PANORAMA_MAX_WIDTH_PX}px) 100vw, ${HERO_PANORAMA_MAX_WIDTH_PX}px`}
                        loading="lazy"
                        fetchPriority="low"
                        quality={82}
                        className="object-cover object-center"
                      />
                    </div>
                    <div className="absolute inset-0 hidden lg:block">
                      <Image
                        src={firstBanner.image_url}
                        alt={firstBanner.title}
                        fill
                        sizes={`(max-width: ${HERO_PANORAMA_MAX_WIDTH_PX}px) 100vw, ${HERO_PANORAMA_MAX_WIDTH_PX}px`}
                        priority
                        fetchPriority="high"
                        quality={82}
                        className="object-cover object-[right_center]"
                      />
                    </div>
                  </>
                ) : null}
                <div className="absolute inset-0 z-[2] hero-scrim" />
                <div className="absolute inset-y-0 right-0 z-[2] w-3/5 hero-overlay-warm mix-blend-soft-light" />
                <div className="absolute inset-y-0 left-1/2 z-[2] w-[18%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--hero-scrim-veil-mid)] to-transparent backdrop-blur-[2px]" />
                <div className="absolute inset-0 z-[2] hero-vignette" />
              </div>
              <div className="absolute inset-0 z-[3] hidden md:block hero-vignette-soft" />
            </>
          ) : null}
        </div>

        <PageContainer size="wide" className="px-3 sm:px-6 lg:px-8 xl:px-10">
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
      </div>
    </section>
  );
}
