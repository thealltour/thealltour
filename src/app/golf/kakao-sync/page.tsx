import type { Metadata } from "next";
import { KakaoSyncGolfLandingPage } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfLandingPage";
import { getHomeGolfTourProducts } from "@/lib/homeGolfTourProducts";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";
import { buildOgBrandFallbackMetadata } from "@/lib/seo/buildOgPageMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildOgBrandFallbackMetadata({
    canonicalPath: "/golf/kakao-sync",
    documentTitle: kakaoSyncGolfConfig.seo.title,
    description: kakaoSyncGolfConfig.seo.description,
    useAbsolutePageTitle: true,
  });
}

export default async function KakaoSyncGolfPage() {
  const products = await getHomeGolfTourProducts();

  return <KakaoSyncGolfLandingPage products={products} />;
}
