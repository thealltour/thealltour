import type { Metadata } from "next";
import { KakaoSyncGolfLandingPage } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfLandingPage";
import { getHomeGolfTourProducts } from "@/lib/homeGolfTourProducts";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";
import { buildOgBrandFallbackMetadata } from "@/lib/seo/buildOgPageMetadata";
import { getSiteSettings } from "@/lib/siteSettings";

export async function generateMetadata(): Promise<Metadata> {
  return buildOgBrandFallbackMetadata({
    canonicalPath: "/golf/kakao-sync",
    documentTitle: kakaoSyncGolfConfig.seo.title,
    description: kakaoSyncGolfConfig.seo.description,
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
