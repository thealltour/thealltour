"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Check, Gift, Lock } from "lucide-react";
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

export function KakaoSyncGolfFixedCta() {
  const { label, stickyTop, stickyBottom } = kakaoSyncGolfConfig.cta;
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
    // OAuth start 서버가 landing_cta_click을 보정 기록한다.
    trackKakaoSyncCtaClick({
      landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
      sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
      templateType: KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
      label,
      href,
      ctaPlacement: "fixed",
    });
  }

  return (
    <div className="shrink-0 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
      <div className="rounded-2xl border border-black/5 bg-white/95 px-2.5 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.14)]">
        <p className="mb-2 flex items-center justify-center gap-1.5 text-center text-[12px] font-medium leading-snug text-slate-500">
          <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
          <span>{stickyTop}</span>
        </p>
        <a
          href={href}
          onClick={handleClick}
          className={buttonVariants({
            variant: "kakao",
            size: "lg",
            // 한글 CTA 라벨은 자간을 좁히면 가독성이 떨어지므로 tracking-tight 미적용
            className:
              "min-h-[3.5rem] w-full gap-2 text-base font-extrabold leading-snug shadow-md sm:text-lg",
          })}
        >
          <Gift className="h-5 w-5 shrink-0" aria-hidden />
          <span>{label}</span>
        </a>
        <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[11px] leading-snug text-slate-400">
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden strokeWidth={2.5} />
          <span>{stickyBottom}</span>
        </p>
      </div>
    </div>
  );
}
