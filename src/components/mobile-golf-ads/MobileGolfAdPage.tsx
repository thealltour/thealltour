"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { MobileGolfAdViewTracker } from "@/components/mobile-golf-ads/MobileGolfAdViewTracker";
import type { MobileGolfAdLanding } from "@/lib/adminMobileGolfAds/types";
import { buildMobileGolfAdPublicPath } from "@/lib/adminMobileGolfAds/types";

export type MobileGolfAdPageProps = {
  landing: MobileGolfAdLanding;
};

export function MobileGolfAdPage({ landing }: MobileGolfAdPageProps) {
  const sourcePath = buildMobileGolfAdPublicPath(landing.slug);
  const kakaoHref = `/api/auth/kakao/start?next=${encodeURIComponent("/mypage")}`;

  return (
    <>
      <MobileGolfAdViewTracker slug={landing.slug} sourcePath={sourcePath} />
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

        <section aria-label="Benefit" className="w-full py-5">
          <p className="whitespace-pre-wrap break-words text-[clamp(0.9375rem,4vw,1.0625rem)] font-bold leading-relaxed text-slate-900">
            {landing.benefitText}
          </p>
        </section>

        <section aria-label="Trust and Action" className="w-full border-t border-slate-100 py-5">
          <p className="whitespace-pre-wrap break-words text-[clamp(0.8125rem,3.6vw,0.9375rem)] leading-relaxed text-slate-700">
            {landing.trustActionText}
          </p>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 w-full pb-[env(safe-area-inset-bottom,0px)]">
        <Link
          href={kakaoHref}
          className={buttonVariants({
            variant: "kakao",
            size: "lg",
            className: "min-h-[3.25rem] w-full rounded-none shadow-lg",
          })}
        >
          간편 가입하기
        </Link>
      </div>
    </>
  );
}
