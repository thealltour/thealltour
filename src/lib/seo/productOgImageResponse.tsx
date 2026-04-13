import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/components/seo/BrandOgCard";
import { ProductOgCard } from "@/components/seo/ProductOgCard";
import { getProductSeoData } from "@/lib/products/getProductSeoData";
import { mapProductSeoToOgPage } from "@/lib/seo/mapProductSeoToOgPage";
import { fetchOgHeroDataUrl } from "@/lib/seo/fetchOgHeroDataUrl";
import { loadTheallLogoDataUrl } from "@/lib/seo/loadOgLogo";

const size = { width: 1200, height: 630 } as const;

/**
 * 상품 상세 `opengraph-image` / `twitter-image` 공통 ImageResponse.
 */
export async function getProductOpenGraphImageResponse(id: string): Promise<ImageResponse> {
  const logoDataUrl = await loadTheallLogoDataUrl();
  const productSeo = await getProductSeoData(id);

  if (!productSeo) {
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

  const seo = mapProductSeoToOgPage(productSeo);
  const heroDataUrl = await fetchOgHeroDataUrl(seo);

  const themeLine =
    productSeo.themeNames.length > 0 ? productSeo.themeNames.slice(0, 3).join(" · ") : null;

  return new ImageResponse(
    (
      <ProductOgCard
        logoDataUrl={logoDataUrl}
        productTitle={productSeo.name?.trim() || "여행 상품"}
        regionLine={productSeo.regionName ?? null}
        themeLine={themeLine}
        summaryLine={productSeo.ogCardSubtitle ?? null}
        priceLabel={productSeo.priceLabel ?? null}
        heroImageDataUrl={heroDataUrl}
      />
    ),
    { ...size },
  );
}
