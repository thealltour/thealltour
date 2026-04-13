import type { OgPageSeoData } from "@/lib/seo/ogPageSeoTypes";

/** `/products` 목록 메타·동적 OG */
export function getProductsIndexOgPageSeo(): OgPageSeoData {
  return {
    type: "products_index",
    id: "products_index",
    urlPath: "/products",
    pageTitle: "여행상품 | 지역·테마별 맞춤 패키지 | 더올투어",
    metaDescription:
      "더올투어 여행상품 목록입니다. 지역·테마·상품군으로 필터링하고 골프·패키지 맞춤 여행을 비교해 보세요.",
    imageCandidates: [],
    primaryImageUrl: null,
    eyebrow: null,
    subtitle: null,
    regionLine: null,
    themeLine: null,
    badgeLabel: null,
    openGraph: { type: "website" },
    ogImageAlt: "더올투어 여행상품",
    useAbsolutePageTitle: true,
  };
}
