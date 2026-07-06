import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MobileGolfAdPage } from "@/components/mobile-golf-ads/MobileGolfAdPage";
import { getPublishedMobileGolfAdLandingBySlug } from "@/lib/adminMobileGolfAds/service";
import { buildMobileGolfAdPublicPath } from "@/lib/adminMobileGolfAds/types";
import {
  buildOgBrandFallbackMetadata,
} from "@/lib/seo/buildOgPageMetadata";

type GolfAdLandingPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: GolfAdLandingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  const canonicalPath = trimmed ? buildMobileGolfAdPublicPath(trimmed) : "/golf/ads";

  if (!trimmed) {
    return buildOgBrandFallbackMetadata({
      canonicalPath,
      documentTitle: "골프투어 | 더올투어",
      description: "더올투어 모바일 골프 랜딩",
      useAbsolutePageTitle: true,
    });
  }

  const landing = await getPublishedMobileGolfAdLandingBySlug(trimmed);
  if (!landing) {
    return buildOgBrandFallbackMetadata({
      canonicalPath,
      documentTitle: "골프투어 | 더올투어",
      description: "요청하신 랜딩을 찾을 수 없거나 비공개입니다.",
      useAbsolutePageTitle: true,
    });
  }

  return buildOgBrandFallbackMetadata({
    canonicalPath,
    documentTitle: landing.seoTitle?.trim() || `${landing.title} | 더올투어`,
    description:
      landing.seoDescription?.trim() ||
      landing.benefitText.slice(0, 120) ||
      "더올투어 골프투어 모바일 랜딩",
    useAbsolutePageTitle: true,
  });
}

export default async function GolfAdLandingPage({ params }: GolfAdLandingPageProps) {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  if (!trimmed) notFound();

  const landing = await getPublishedMobileGolfAdLandingBySlug(trimmed);
  if (!landing) notFound();

  return <MobileGolfAdPage landing={landing} />;
}
