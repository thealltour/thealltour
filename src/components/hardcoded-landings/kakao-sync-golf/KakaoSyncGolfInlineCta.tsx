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

const FALLBACK_HREF =
  "/api/auth/kakao/start?next=%2Fmypage%2Fdashboard&landing_slug=kakao-sync&landing_path=%2Fgolf%2Fkakao-sync";

/**
 * Benefit 섹션 바로 아래 배치되는 보조 CTA.
 * Benefit만 보고 바로 결심한 사용자가 하단 고정 바를 찾을 필요 없이 즉시 클릭할 수 있게 함.
 * href/트래킹 로직은 KakaoSyncGolfFixedCta와 동일, ctaPlacement로만 구분.
 */
export function KakaoSyncGolfInlineCta() {
  const label = kakaoSyncGolfConfig.cta.label;
  const [href, setHref] = useState(FALLBACK_HREF);

  useEffect(() => {
    setHref(
      buildKakaoSyncAuthStartHref({
        next: "/mypage/dashboard",
        landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
        sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
      }),
    );
  }, []);

  function handleClick(_e: MouseEvent<HTMLAnchorElement>) {
    // 기본 네비게이션 유지 — preventDefault/assign 레이스로 beacon 유실 방지.
    trackKakaoSyncCtaClick({
      landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
      sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
      templateType: KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
      label,
      href,
      ctaPlacement: "inline",
    });
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={buttonVariants({
        variant: "kakao",
        size: "lg",
        // 한글 CTA 라벨은 자간을 좁히면 가독성이 떨어지므로 tracking-tight 미적용
        className: "mt-3 min-h-[3rem] w-full text-sm font-extrabold leading-snug shadow-sm sm:text-base",
      })}
    >
      {label}
    </a>
  );
}
