import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { ProductOgCard } from "@/components/seo/ProductOgCard";
import { getProductSeoData } from "@/lib/products/getProductSeoData";
import { fetchOgImageAsDataUrl } from "@/lib/seo/fetchOgImageAsDataUrl";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

/**
 * 상품 상세 `opengraph-image` / `twitter-image` 공통 ImageResponse.
 */
export async function getProductOpenGraphImageResponse(id: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  const seo = await getProductSeoData(id);

  if (!seo) {
    return new ImageResponse(
      (
        <BrandOgCard
          title="여행 상품"
          subtitle="더올투어에서 맞춤 여행을 찾아보세요."
          logoDataUrl={logoDataUrl}
        />
      ),
      { ...size },
    );
  }

  let heroDataUrl: string | null = null;
  for (const url of seo.imageCandidates) {
    heroDataUrl = await fetchOgImageAsDataUrl(url);
    if (heroDataUrl) break;
  }

  const themeLine =
    seo.themeNames.length > 0 ? seo.themeNames.slice(0, 3).join(" · ") : null;

  return new ImageResponse(
    (
      <ProductOgCard
        logoDataUrl={logoDataUrl}
        productTitle={seo.name}
        regionLine={seo.regionName}
        themeLine={themeLine}
        summaryLine={seo.ogCardSubtitle}
        priceLabel={seo.priceLabel}
        heroImageDataUrl={heroDataUrl}
      />
    ),
    { ...size },
  );
}
