import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { ThemeOgCard } from "@/components/seo/ThemeOgCard";
import { getThemeSeoData } from "@/lib/themes/getThemeSeoData";
import { fetchOgHeroDataUrl } from "@/lib/seo/fetchOgHeroDataUrl";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

export async function getThemeOpenGraphImageResponse(slug: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  const seo = await getThemeSeoData(slug);

  if (!seo) {
    return new ImageResponse(
      (
        <BrandOgCard
          title="테마 여행"
          subtitle="더올투어에서 테마별 여행을 찾아보세요."
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
