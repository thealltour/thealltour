"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { MobileGolfAdBodyRenderer } from "@/components/mobile-golf-ads/MobileGolfAdBodyRenderer";
import { MobileGolfAdViewTracker } from "@/components/mobile-golf-ads/MobileGolfAdViewTracker";
import type { MobileGolfAdLanding } from "@/lib/adminMobileGolfAds/types";
import { buildMobileGolfAdPublicPath } from "@/lib/adminMobileGolfAds/types";
import {
  buildKakaoSyncAuthStartHref,
  trackKakaoSyncCtaClick,
} from "@/lib/analytics/trackKakaoSyncFunnel";
import type { ProductCardSource } from "@/lib/products/productListItem";

export type MobileGolfAdPageProps = {
  landing: MobileGolfAdLanding;
  productsById?: Map<string, ProductCardSource>;
  homeGolfProducts?: ProductCardSource[];
  /** 미리보기 모드 — 트래커 비활성화 */
  previewMode?: boolean;
};

export function MobileGolfAdPage({
  landing,
  productsById,
  homeGolfProducts,
  previewMode = false,
}: MobileGolfAdPageProps) {
  const sourcePath = buildMobileGolfAdPublicPath(landing.slug);
  const ctaLabel = "간편 가입하기";
  const fallbackHref = `/api/auth/kakao/start?next=/mypage/dashboard&landing_slug=${encodeURIComponent(landing.slug)}&landing_path=${encodeURIComponent(sourcePath)}`;
  const [href, setHref] = useState(fallbackHref);

  useEffect(() => {
    if (previewMode) return;
    setHref(
      buildKakaoSyncAuthStartHref({
        next: "/mypage/dashboard",
        landingSlug: landing.slug,
        sourcePath,
      }),
    );
  }, [landing.slug, previewMode, sourcePath]);

  function handleCtaClick(e: MouseEvent<HTMLAnchorElement>) {
    if (previewMode) {
      e.preventDefault();
      return;
    }
    trackKakaoSyncCtaClick({
      landingSlug: landing.slug,
      sourcePath,
      templateType: "mobile_golf_ad",
      label: ctaLabel,
      href,
    });
  }

  return (
    <>
      {!previewMode ? (
        <MobileGolfAdViewTracker slug={landing.slug} sourcePath={sourcePath} />
      ) : null}
      <main className="w-full bg-white">
        <section aria-label="Hero">
          {/* eslint-disable-next-line @next/next/no-img-element -- CMS 업로드 원본 비율 유지 */}
          <img
            src={landing.heroImageUrl}
            alt={landing.title}
            className="block h-auto w-full max-w-full"
            loading="eager"
            decoding="async"
          />
        </section>

        <MobileGolfAdBodyRenderer
          bodyDoc={landing.bodyDoc}
          productsById={productsById}
          homeGolfProducts={homeGolfProducts}
        />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 w-full pb-[env(safe-area-inset-bottom,0px)]">
        <a
          href={previewMode ? "#" : href}
          onClick={handleCtaClick}
          className={buttonVariants({
            variant: "kakao",
            size: "lg",
            className: "min-h-[3.25rem] w-full rounded-none shadow-lg",
          })}
        >
          {ctaLabel}
        </a>
      </div>
    </>
  );
}
