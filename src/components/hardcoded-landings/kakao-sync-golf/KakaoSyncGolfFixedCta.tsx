"use client";

import type { MouseEvent } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";
import {
  KAKAO_SYNC_GOLF_LANDING_SLUG,
  KAKAO_SYNC_GOLF_PUBLIC_PATH,
  KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
  buildKakaoSyncAuthStartHref,
  trackKakaoSyncCtaClick,
} from "@/lib/analytics/trackKakaoSyncFunnel";

export function KakaoSyncGolfFixedCta() {
  const label = kakaoSyncGolfConfig.cta.label;

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const href = buildKakaoSyncAuthStartHref({
      next: "/mypage",
      landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
      sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
    });
    trackKakaoSyncCtaClick({
      landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
      sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
      templateType: KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
      label,
      href,
    });
    window.location.assign(href);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
      <div className="pointer-events-auto w-full rounded-2xl border border-black/5 bg-white/95 p-2 shadow-[0_8px_28px_rgba(0,0,0,0.14)] backdrop-blur-sm">
        <a
          href="/api/auth/kakao/start?next=/mypage"
          onClick={handleClick}
          className={buttonVariants({
            variant: "kakao",
            size: "lg",
            className:
              "min-h-[3.5rem] w-full text-base font-extrabold leading-snug tracking-tight shadow-md sm:text-lg",
          })}
        >
          {label}
        </a>
      </div>
    </div>
  );
}
