import { LandingDetailHero } from "@/components/landing/LandingDetailHero";
import LandingHeroActions from "@/components/landings/sections/LandingHeroActions";
import { buildLandingQuoteHref } from "@/lib/landings/buildLandingQuoteHref";
import { getTaxonomyHeroImageFallback } from "@/lib/landingMetadata";
import { getTaxonomyById } from "@/lib/productTaxonomies";
import type { AdminLandingDetail, AdminLandingSection } from "@/types/adminLanding";

type LandingHeroSectionProps = {
  landing: AdminLandingDetail;
  section: AdminLandingSection;
  sourcePath: string;
  /** 목적지 랜딩 등 추천 상품 블록이 있을 때 히어로에 스크롤 CTA 표시 */
  showHeroProductScrollCta?: boolean;
};

/**
 * SEO(`getRecommendedLandingSeoData`)와 동일: taxonomy hero_image_url → card_image_url.
 * `LandingDetailHero`가 imageUrl 없으면 공통 fallback 사용.
 */
export default async function LandingHeroSection({
  landing,
  section,
  sourcePath,
  showHeroProductScrollCta = false,
}: LandingHeroSectionProps) {
  let imageUrl: string | null = null;
  const taxId = landing.sourceTaxonomyId?.trim();
  if (taxId) {
    const taxonomy = await getTaxonomyById(taxId);
    if (taxonomy) {
      imageUrl = getTaxonomyHeroImageFallback(taxonomy);
    }
  }

  const primary = section.description?.trim() || landing.summary || "";
  const body = section.body?.trim() ?? "";
  const merged =
    body && body !== primary ? [primary, body].filter(Boolean).join("\n\n") : primary || body;

  const quoteHref = buildLandingQuoteHref(landing, sourcePath);

  return (
    <LandingDetailHero
      title={section.title?.trim() || landing.title}
      description={merged || undefined}
      imageUrl={imageUrl}
      actions={
        <LandingHeroActions
          landing={landing}
          sourcePath={sourcePath}
          quoteHref={quoteHref}
          showScrollToProducts={showHeroProductScrollCta}
        />
      }
    />
  );
}
