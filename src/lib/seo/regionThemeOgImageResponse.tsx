import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { DestinationOgCard } from "@/components/seo/DestinationOgCard";
import { ThemeOgCard } from "@/components/seo/ThemeOgCard";
import {
  getProductRegionOgPageSeo,
  getProductThemeOgPageSeo,
} from "@/lib/products/productRegionThemeOgPageSeo";
import { fetchOgHeroDataUrl } from "@/lib/seo/fetchOgHeroDataUrl";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

export async function getRegionOgImageResponse(slug: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  const trimmed = slug?.trim() ?? "";
  const seo = trimmed ? await getProductRegionOgPageSeo(trimmed) : null;

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

  const heroDataUrl = await fetchOgHeroDataUrl(seo);
  const title = seo.contentTitle?.trim() || "지역 여행";

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

export async function getThemeOgImageResponse(slug: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  const trimmed = slug?.trim() ?? "";
  const seo = trimmed ? await getProductThemeOgPageSeo(trimmed) : null;

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

  const heroDataUrl = await fetchOgHeroDataUrl(seo);
  const title = seo.contentTitle?.trim() || "테마 여행";

  return new ImageResponse(
    (
      <ThemeOgCard
        logoDataUrl={logoDataUrl}
        title={title}
        descriptionLine={seo.subtitle}
        heroImageDataUrl={heroDataUrl}
      />
    ),
    { ...size },
  );
}
