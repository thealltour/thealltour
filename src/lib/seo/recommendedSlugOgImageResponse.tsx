import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { RecommendedLandingOgCard } from "@/components/seo/RecommendedLandingOgCard";
import { getRecommendedLandingSeoData } from "@/lib/recommended/getRecommendedLandingSeoData";
import { fetchOgHeroDataUrl } from "@/lib/seo/fetchOgHeroDataUrl";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

export async function getRecommendedSlugOpenGraphImageResponse(slug: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  const seo = await getRecommendedLandingSeoData(slug);

  if (!seo) {
    return new ImageResponse(
      (
        <BrandOgCard
          title="추천 여행"
          subtitle="더올투어에서 맞춤 추천 랜딩을 찾아보세요."
          logoDataUrl={logoDataUrl}
          variant="home"
          backgroundVariant="navyWarm"
        />
      ),
      { ...size },
    );
  }

  const heroDataUrl = await fetchOgHeroDataUrl(seo);
  const title = seo.contentTitle?.trim() || "추천 여행";
  const detail = seo.subtitle?.trim() || seo.metaDescription;

  return new ImageResponse(
    (
      <RecommendedLandingOgCard
        logoDataUrl={logoDataUrl}
        title={title}
        descriptionLine={detail}
        heroImageDataUrl={heroDataUrl}
      />
    ),
    { ...size },
  );
}
