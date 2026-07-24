"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";
import {
  KAKAO_SYNC_GOLF_LANDING_SLUG,
  KAKAO_SYNC_GOLF_PUBLIC_PATH,
  KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
  buildKakaoSyncAuthStartHref,
  trackKakaoSyncCtaClick,
} from "@/lib/analytics/trackKakaoSyncFunnel";

const FALLBACK_HREF = "/api/auth/kakao/start?next=/mypage&landing_slug=kakao-sync&landing_path=%2Fgolf%2Fkakao-sync";

export function KakaoSyncGolfFixedCta() {
  const label = kakaoSyncGolfConfig.cta.label;
  const [href, setHref] = useState(FALLBACK_HREF);

  useEffect(() => {
    setHref(
      buildKakaoSyncAuthStartHref({
        next: "/mypage",
        landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
        sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
      }),
    );
  }, []);

  function handleClick(_e: MouseEvent<HTMLAnchorElement>) {
    // 기본 네비게이션 유지 — preventDefault/assign 레이스로 beacon 유실 방지.
    // OAuth start 서버가 landing_cta_click을 보정 기록한다.
    trackKakaoSyncCtaClick({
      landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
      sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
      templateType: KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
      label,
      href,
    });
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
      <div className="pointer-events-auto w-full rounded-2xl border border-black/5 bg-white/95 p-2 shadow-[0_8px_28px_rgba(0,0,0,0.14)] backdrop-blur-sm">
        <a
          href={href}
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
