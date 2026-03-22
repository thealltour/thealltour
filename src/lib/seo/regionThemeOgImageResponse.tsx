import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { getRegionSeoData } from "@/lib/products/getRegionSeoData";
import { getThemeSeoData } from "@/lib/products/getThemeSeoData";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

export async function getRegionOgImageResponse(slug: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  const seo = await getRegionSeoData(slug);

  if (!seo) {
    return new ImageResponse(
      (
        <BrandOgCard
          tagLabel="REGION"
          title="지역 여행"
          subtitle="더올투어 맞춤 골프·테마 여행"
          logoDataUrl={logoDataUrl}
          variant="region"
        />
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <BrandOgCard
        tagLabel="REGION"
        eyebrow="더올투어"
        title={seo.ogTitle}
        subtitle={seo.ogSubtitle}
        logoDataUrl={logoDataUrl}
        variant="region"
      />
    ),
    { ...size },
  );
}

export async function getThemeOgImageResponse(slug: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  const seo = await getThemeSeoData(slug);

  if (!seo) {
    return new ImageResponse(
      (
        <BrandOgCard
          tagLabel="THEME"
          title="테마 여행"
          subtitle="더올투어 맞춤 여행 상품"
          logoDataUrl={logoDataUrl}
          variant="theme"
        />
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <BrandOgCard
        tagLabel="THEME"
        eyebrow="더올투어"
        title={seo.ogTitle}
        subtitle={seo.ogSubtitle}
        logoDataUrl={logoDataUrl}
        variant="theme"
      />
    ),
    { ...size },
  );
}
