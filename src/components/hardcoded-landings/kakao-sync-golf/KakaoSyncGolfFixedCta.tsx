"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
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
import { buildGolfProductsHref } from "@/lib/products/golfChannel";
import { cn } from "@/lib/cn";

const FALLBACK_HREF =
  "/api/auth/kakao/start?next=%2Fmypage%2Fdashboard&landing_slug=kakao-sync&landing_path=%2Fgolf%2Fkakao-sync";

type KakaoSyncGolfFixedCtaProps = {
  /** Layout(server)에서 session으로 전달 — 안전할 때만 분기 */
  isLoggedIn?: boolean;
};

export function KakaoSyncGolfFixedCta({ isLoggedIn = false }: KakaoSyncGolfFixedCtaProps) {
  const { label, stickyTop, stickyBottom } = kakaoSyncGolfConfig.cta;
  const [href, setHref] = useState(FALLBACK_HREF);
  const golfHref = buildGolfProductsHref();

  useEffect(() => {
    if (isLoggedIn) return;
    setHref(
      buildKakaoSyncAuthStartHref({
        next: "/mypage/dashboard",
        landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
        sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
      }),
    );
  }, [isLoggedIn]);

  function handleClick(_e: MouseEvent<HTMLAnchorElement>) {
    trackKakaoSyncCtaClick({
      landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
      sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
      templateType: KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
      label,
      href,
      ctaPlacement: "fixed",
    });
  }

  if (isLoggedIn) {
    return (
      <div className="shrink-0 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="rounded-2xl border border-black/5 bg-white/95 px-2.5 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.14)]">
          <p className="mb-2 text-center text-[12px] font-medium leading-snug text-slate-500">
            이미 로그인된 회원입니다 · 골프 혜택은 마이페이지에서 확인하세요
          </p>
          <Link
            href={golfHref}
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "min-h-[3.5rem] w-full gap-2 text-base font-extrabold leading-snug shadow-md sm:text-lg",
            )}
          >
            골프여행 상품 보기
          </Link>
        </div>
      </div>
    );
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
