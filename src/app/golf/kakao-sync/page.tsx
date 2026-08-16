import type { Metadata } from "next";
import { KakaoSyncGolfLandingPage } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfLandingPage";
import { getHomeGolfTourProducts } from "@/lib/homeGolfTourProducts";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";
import { buildOgPageMetadata } from "@/lib/seo/buildOgPageMetadata";
import { getSiteBaseUrl } from "@/lib/seo/getSiteSeoDefaults";
import { getSiteSettings } from "@/lib/siteSettings";

export async function generateMetadata(): Promise<Metadata> {
  return buildOgPageMetadata({
    siteUrl: getSiteBaseUrl(),
    canonicalPath: "/golf/kakao-sync",
    documentTitle: kakaoSyncGolfConfig.seo.title,
    description: kakaoSyncGolfConfig.seo.description,
    ogImagePath: "/golf/kakao-sync/opengraph-image",
    twitterImagePath: "/golf/kakao-sync/twitter-image",
    ogImageAlt: "1인당 5만원 · 팀 전체 무제한 할인 — 더올투어 카카오 간편가입",
    useAbsolutePageTitle: true,
  });
}

export default async function KakaoSyncGolfPage() {
  const [products, settings] = await Promise.all([
    getHomeGolfTourProducts(),
    getSiteSettings(),
  ]);

  return (
    <KakaoSyncGolfLandingPage
      products={products}
      tourismRegNo={settings.tourism_reg_no}
    />
  );
}
