import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import LandingPageRenderer from "@/components/landings/LandingPageRenderer";
import { getPublicLandingBySlug } from "@/lib/adminLandings/service";
import { getRecommendedLandingSeoData } from "@/lib/recommended/getRecommendedLandingSeoData";
import {
  buildOgBrandFallbackMetadata,
  buildOgMetadataFromSeoData,
} from "@/lib/seo/buildOgPageMetadata";

type RecommendedLandingDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: RecommendedLandingDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  if (!trimmed) {
    return buildOgBrandFallbackMetadata({
      canonicalPath: "/recommended",
      documentTitle: "여행추천 | 더올투어",
      description: "더올투어 추천 여행 랜딩을 둘러보세요.",
      useAbsolutePageTitle: true,
    });
  }
  const seo = await getRecommendedLandingSeoData(trimmed);
  if (!seo) {
    return buildOgBrandFallbackMetadata({
      canonicalPath: `/recommended/${trimmed}`,
      documentTitle: "추천 여행 | 더올투어",
      description: "요청하신 추천 랜딩을 찾을 수 없거나 비공개입니다.",
      useAbsolutePageTitle: true,
    });
  }
  return buildOgMetadataFromSeoData(seo);
}

export default async function RecommendedLandingDetailPage({ params }: RecommendedLandingDetailPageProps) {
  const { slug } = await params;
  const landing = await getPublicLandingBySlug(slug);
  if (!landing) notFound();

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />
      <LandingPageRenderer
        landing={landing}
        mode="public"
        sourcePath={`/recommended/${encodeURIComponent(slug)}`}
      />
    </div>
  );
}
