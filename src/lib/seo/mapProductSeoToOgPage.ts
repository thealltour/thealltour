import type { ProductSeoData } from "@/lib/products/getProductSeoData";
import type { OgPageSeoData } from "@/lib/seo/ogPageSeoTypes";

/** 상품 getter 결과 → 전역 OG 스냅샷 */
export function mapProductSeoToOgPage(seo: ProductSeoData): OgPageSeoData {
  const themeLine =
    seo.themeNames.length > 0 ? seo.themeNames.slice(0, 3).join(" · ") : null;
  const name = seo.name?.trim() || "여행 상품";
  return {
    type: "product",
    id: seo.id,
    urlPath: `/products/${seo.id}`,
    contentTitle: name,
    pageTitle: `${name} | 일정·가격·후기 한눈에 | 더올투어`,
    metaDescription: `${name} 여행 상품 상세 정보입니다. 일정, 가격, 후기까지 한 번에 확인하고 상담으로 맞춤 여행을 준비해보세요.`,
    imageCandidates: seo.imageCandidates,
    primaryImageUrl: seo.primaryImageUrl,
    eyebrow: seo.regionName,
    subtitle: seo.ogCardSubtitle,
    regionLine: seo.regionName,
    themeLine,
    badgeLabel: null,
    openGraph: { type: "article" },
    ogImageAlt: name,
    priceLabel: seo.priceLabel,
    useAbsolutePageTitle: true,
  };
}
