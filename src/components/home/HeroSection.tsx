import type { ReactNode } from "react";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";
import type { HomeBanner } from "@/types/homeBanner";
import { cn } from "@/lib/cn";
import { HeroPanoramaSlideshowClient } from "@/components/home/HeroPanoramaSlideshowClient";

/** 태블릿(md~lg 미만): mobile_image_url 우선, 없으면 PC 이미지 */
function bannerSrcForMidViewport(banner: HomeBanner): string {
  const m = banner.mobile_image_url?.trim();
  return m && m.length > 0 ? m : banner.image_url;
}

/** 모바일 우선 배너 소스 */
function bannerSrcForMobile(banner: HomeBanner): string {
  const m = banner.mobile_image_url?.trim();
  return m && m.length > 0 ? m : banner.image_url;
}

/** PageContainer `wide`와 동일 — 파노라마·srcset이 뷰포트 전체로 불필요 확대되지 않도록 */
const HERO_PANORAMA_MAX_WIDTH_PX = 1600;

/** md+ 파노라마 — 340~380px 대역 (1440×900에서 첫 추천 카드가 보이도록 상한 유지) */
const HERO_PANORAMA_HEIGHT_CLASS = "min-h-[340px] h-[clamp(340px,40vh,380px)]";

/** 모바일 배너 — 짧은 현행 높이 유지 */
const HERO_MOBILE_HEIGHT_CLASS = "min-h-[120px] h-[min(24vh,180px)]";

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
      <span className="text-white">{accent}</span>
      {shortTail ? <span className="text-white/95"> {shortTail}</span> : null}
    </>
  );
}

export type HeroSectionProps = {
  /** @deprecated 골프/플래너 페어는 HomeTravelPathways로 이동. 하위 호환용 무시됨. */
  golfEntryHref?: string;
  /** 추천 골프상품 앵커 (#home-golf-tours). 없으면 CTA 숨김 */
  golfToursHref?: string | null;
  /** 출발 일정 달력 앵커 (#home-golf-dates). 없으면 CTA 숨김 */
  golfDatesHref?: string | null;
  /**
   * 활성 배너 목록 (`getHomeBanners` 정렬 순). 0장이면 배경 없음, 1장이면 단일, 2장+ fade 슬라이드.
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
 * 홈 최상단 Hero 섹션 — PageContainer wide 기준선에 맞춘 배너 + 짧은 제목.
 * 검색은 공통 헤더로 이동. 골프 탐색은 홈 바로가기·골프 섹션에서 접근.
 */
export default function HeroSection({
  heroBanners = [],
  hero,
}: HeroSectionProps) {
  const hasBanners = heroBanners.length > 0;
  const firstBanner = heroBanners[0] ?? null;

  return (
    <section className="relative w-full">
      <PageContainer size="wide" className="md:pt-2 lg:pt-3">
        <div
          className={cn(
            "relative overflow-hidden bg-[var(--hero-bg)]",
            "md:rounded-2xl lg:rounded-3xl",
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-0 overflow-hidden",
              "md:rounded-2xl lg:rounded-3xl",
            )}
            aria-hidden
          >
            {hasBanners ? (
              <>
                {/* 모바일: 낮은 배너 이미지 */}
                <div className={cn("absolute inset-0 z-0 md:hidden", HERO_MOBILE_HEIGHT_CLASS)}>
                  {firstBanner ? (
                    <Image
                      src={bannerSrcForMobile(firstBanner)}
                      alt={firstBanner.title}
                      fill
                      sizes="100vw"
                      priority
                      fetchPriority="high"
                      quality={78}
                      className="object-cover object-center"
                    />
                  ) : null}
                  <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black/55 via-black/25 to-black/10" />
                </div>

                {/* md+: 파노라마 */}
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
                          className="object-cover object-[center_40%]"
                        />
                      </div>
                    </>
                  ) : null}
                  <div className="absolute inset-0 z-[2] hero-scrim" />
                  <div className="absolute inset-y-0 right-0 z-[2] w-3/5 hero-overlay-warm mix-blend-soft-light" />
                  <div className="absolute inset-0 z-[2] hero-vignette" />
                </div>
              </>
            ) : (
              <div className="absolute inset-0 z-0 bg-[var(--primary-soft)] md:hidden" />
            )}
          </div>

          <div
            className={cn(
              "relative z-10 flex min-w-0 max-w-full flex-col items-center justify-end px-3 text-center sm:px-6",
              "pt-8 pb-4 sm:pt-10 sm:pb-5",
              "md:min-h-[340px] md:justify-center md:px-8 md:py-8",
              "lg:min-h-[clamp(340px,40vh,380px)] lg:py-9",
              !hasBanners && "min-h-[120px]",
            )}
          >
            <h1 className="max-w-[20rem] font-semibold leading-snug tracking-tight text-white text-[1.35rem] drop-shadow-sm sm:max-w-xl sm:text-[1.85rem] sm:leading-tight md:max-w-3xl md:text-[2.25rem] md:leading-[1.2] lg:text-[2.75rem] lg:leading-[1.15]">
              <span className="md:hidden">
                <MobileHeroHeadline hero={hero} />
              </span>
              <span className="hidden md:inline">
                {hero.main_copy_accent ? (
                  <>
                    <span className="text-white">{hero.main_copy_accent}</span>
                    <span className="text-white/95">{hero.main_copy_tail}</span>
                  </>
                ) : (
                  hero.main_copy_tail?.trim() || "골프와 여행의 시작"
                )}
              </span>
            </h1>
            {hero.sub_description ? (
              <p className="mt-2 hidden max-w-xl text-sm font-medium leading-snug text-white/85 md:mt-3 md:block md:text-base md:drop-shadow-sm">
                {hero.sub_description}
              </p>
            ) : null}
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
