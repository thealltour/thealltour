"use client";

import { buttonVariants } from "@/components/ui/Button";
import { MobileGolfAdBodyRenderer } from "@/components/mobile-golf-ads/MobileGolfAdBodyRenderer";
import { MobileGolfAdViewTracker } from "@/components/mobile-golf-ads/MobileGolfAdViewTracker";
import {
  MOBILE_GOLF_AD_KAKAO_SYNC_AUTH_URL,
  type MobileGolfAdLanding,
} from "@/lib/adminMobileGolfAds/types";
import { buildMobileGolfAdPublicPath } from "@/lib/adminMobileGolfAds/types";
import type { Product } from "@/types/product";

export type MobileGolfAdPageProps = {
  landing: MobileGolfAdLanding;
  productsById?: Map<string, Product>;
  homeGolfProducts?: Product[];
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
          href={MOBILE_GOLF_AD_KAKAO_SYNC_AUTH_URL}
          className={buttonVariants({
            variant: "kakao",
            size: "lg",
            className: "min-h-[3.25rem] w-full rounded-none shadow-lg",
          })}
        >
          간편 가입하기
        </a>
      </div>
    </>
  );
}
