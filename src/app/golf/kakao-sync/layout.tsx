import type { ReactNode } from "react";
import { KakaoSyncGolfFixedCta } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfFixedCta";
import { KakaoSyncLandingFooter } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncLandingFooter";
import { getSiteSettings } from "@/lib/siteSettings";

/** 카카오싱크 하드코딩 랜딩: PC는 500px 중앙 폰 프레임, 모바일은 전폭. CTA는 프레임 하단 고정. */
export default async function KakaoSyncGolfLayout({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();

  return (
    <div className="flex h-dvh justify-center bg-slate-100">
      <div className="flex h-full w-full max-w-[500px] flex-col overflow-hidden bg-white shadow-2xl">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {children}
          <KakaoSyncLandingFooter settings={settings} />
        </div>
        <KakaoSyncGolfFixedCta />
      </div>
    </div>
  );
}

