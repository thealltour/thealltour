import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { DestinationOgCard } from "@/components/seo/DestinationOgCard";
import { getDestinationSeoData } from "@/lib/destinations/getDestinationSeoData";
import { fetchOgHeroDataUrl } from "@/lib/seo/fetchOgHeroDataUrl";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

export async function getDestinationOpenGraphImageResponse(slug: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  const seo = await getDestinationSeoData(slug);

  if (!seo) {
    return new ImageResponse(
      (
        <BrandOgCard
          title="여행지"
          subtitle="더올투어에서 지역별 여행을 찾아보세요."
          logoDataUrl={logoDataUrl}
        />
      ),
      { ...size },
    );
  }

  const heroDataUrl = await fetchOgHeroDataUrl(seo);
  const title = seo.contentTitle?.trim() || seo.ogImageAlt;

  return new ImageResponse(
    (
      <DestinationOgCard
        logoDataUrl={logoDataUrl}
        title={title}
        descriptionLine={seo.subtitle}
        heroImageDataUrl={heroDataUrl}
      />
    ),
    { ...size },
  );
}
