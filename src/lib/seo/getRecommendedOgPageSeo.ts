import type { OgPageSeoData } from "@/lib/seo/ogPageSeoTypes";

/** `/recommended` 큐레이션 허브 */
export function getRecommendedOgPageSeo(): OgPageSeoData {
  return {
    type: "recommended",
    id: "recommended",
    urlPath: "/recommended",
    pageTitle: "여행추천 | 더올투어",
    metaDescription:
      "더올투어가 선별한 추천 여행·골프·패키지 상품을 만나보세요. 큐레이션된 코스로 쉽게 탐색할 수 있습니다.",
    imageCandidates: [],
    primaryImageUrl: null,
    eyebrow: null,
    subtitle: null,
    regionLine: null,
    themeLine: null,
    badgeLabel: null,
    openGraph: { type: "website" },
    ogImageAlt: "더올투어 여행추천",
    useAbsolutePageTitle: true,
  };
}
