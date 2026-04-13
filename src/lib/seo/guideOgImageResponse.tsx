import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { GuideOgCard } from "@/components/seo/GuideOgCard";
import { getGuideSeoData } from "@/lib/guides/getGuideSeoData";
import { fetchOgHeroDataUrl } from "@/lib/seo/fetchOgHeroDataUrl";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

export async function getGuideOpenGraphImageResponse(slug: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  const seo = await getGuideSeoData(slug);

  if (!seo) {
    return new ImageResponse(
      (
        <BrandOgCard
          title="여행 가이드"
          subtitle="더올투어에서 여행 정보를 찾아보세요."
          logoDataUrl={logoDataUrl}
        />
      ),
      { ...size },
    );
  }

  const heroDataUrl = await fetchOgHeroDataUrl(seo);

  const cardTitle = seo.contentTitle?.trim() || "여행 가이드";

  return new ImageResponse(
    (
      <GuideOgCard
        logoDataUrl={logoDataUrl}
        title={cardTitle}
        categoryLabel={seo.categoryLabel}
        contextLine={seo.subtitle}
        heroImageDataUrl={heroDataUrl}
      />
    ),
    { ...size },
  );
}
