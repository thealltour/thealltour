/**
 * 사이트 전역 OG/메타데이터용 공통 SEO 스냅샷.
 * getter → buildOgPageMetadata / opengraph-image 라우트에서 동일 구조로 소비.
 */

export type OgContentType =
  | "product"
  | "guide"
  | "destination"
  | "theme"
  | "brand"
  | "home"
  | "products_index"
  | "recommended"
  | "recommended_landing"
  | "product_region"
  | "product_theme";

export type OgPageSeoData = {
  type: OgContentType;
  id: string;
  /** canonical 경로 (선행 슬래시, 쿼리 없음). 예: `/products/abc`, `/guides/foo` */
  urlPath: string;
  /** `<title>` / OG title에 쓰는 완성 문자열 */
  pageTitle: string;
  metaDescription: string;
  /** OG 페인트용 절대 URL 후보 */
  imageCandidates: string[];
  primaryImageUrl: string | null;
  eyebrow: string | null;
  subtitle: string | null;
  regionLine: string | null;
  themeLine: string | null;
  badgeLabel: string | null;
  openGraph: {
    type: "website" | "article";
  };
  /** openGraph.images / twitter 대표 이미지 alt */
  ogImageAlt: string;
  /** OG 카드 본문 제목(사이트 접미사 없음). 없으면 호출측에서 pageTitle 기반 처리 */
  contentTitle?: string;
  /** `urlPath`가 `/` 등 비표준일 때 opengraph/twitter 경로 직접 지정 */
  ogImageRoute?: string | null;
  twitterImageRoute?: string | null;
  /** true면 `metadata.title`을 `{ absolute: pageTitle }`로 설정(layout template 중복 방지) */
  useAbsolutePageTitle?: boolean;
  /** 상품 전용 */
  priceLabel?: string | null;
  /** 가이드 전용 */
  categoryLabel?: string | null;
  readingTimeLabel?: string | null;
};
