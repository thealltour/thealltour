import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { KakaoSyncGolfFixedCta } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfFixedCta";
import { KakaoSyncLandingFooter } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncLandingFooter";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getSiteSettings } from "@/lib/siteSettings";

/** 카카오싱크 하드코딩 랜딩: PC는 500px 중앙 폰 프레임, 모바일은 전폭. CTA는 프레임 하단 고정. */
export default async function KakaoSyncGolfLayout({ children }: { children: ReactNode }) {
  const [settings, cookieStore] = await Promise.all([getSiteSettings(), cookies()]);
  const session = getMemberSessionFromCookies(cookieStore);

  return (
    <div className="flex h-dvh justify-center bg-slate-100">
      <style>{`
        iframe[src*="talk.naver.com"],
        #naver-talk-button,
        #naver-talktalk,
        .naver-talk-button,
        #talk_banner_div,
        #ntalk-button {
          position: fixed !important;
          bottom: 6.5rem !important;
          right: 1rem !important;
          left: auto !important;
          z-index: 40 !important;
        }
      `}</style>
      <div className="flex h-full w-full max-w-[500px] flex-col overflow-hidden bg-white shadow-2xl">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {children}
          <KakaoSyncLandingFooter settings={settings} />
        </div>
        <KakaoSyncGolfFixedCta isLoggedIn={Boolean(session)} />
      </div>
    </div>
  );
}
