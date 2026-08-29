import type { StickySectionNavSection } from "@/components/navigation/StickySectionNav";

export type TaxonomyDetailNavInput = {
  /** 도시·지역 / 세부 테마 등 하위 브라우즈 */
  childSection?: { id: string; label: string };
  hasFeaturedLinks: boolean;
  /** 가이드 섹션 노출 */
  hasGuides: boolean;
  /** CuratedBlock 추천 상품 */
  hasRecommended: boolean;
  /** 함께 보기(연관 테마·지역) 칩 */
  hasRelatedTaxonomies: boolean;
  hasReviews: boolean;
};

/**
 * `/destinations/[slug]`·`/themes/[slug]`·`/products/region|theme/[slug]` 공통 앵커 내비.
 * `landing-subnodes`(세부 탐색)는 플레이스홀더만 있어도 항상 포함해 허브와 동일하게 스크롤 스파이가 끊기지 않게 함.
 */
export function buildTaxonomyDetailNavSections(input: TaxonomyDetailNavInput): StickySectionNavSection[] {
  const out: StickySectionNavSection[] = [];
  if (input.childSection) {
    out.push({ id: input.childSection.id, label: input.childSection.label });
  }
  if (input.hasFeaturedLinks) {
    out.push({ id: "featured-links", label: "바로가기" });
  }
  out.push({ id: "landing-subnodes", label: "세부 탐색" });
  if (input.hasRecommended) {
    out.push({ id: "recommended-products", label: "여행상품" });
  }
  if (input.hasGuides) {
    out.push({ id: "guides", label: "가이드" });
  }
  if (input.hasRelatedTaxonomies) {
    out.push({ id: "related-taxonomies", label: "함께 보기" });
  }
  if (input.hasReviews) {
    out.push({ id: "reviews", label: "후기" });
  }
  out.push({ id: "all-products", label: "전체 상품 조회" });
  return out;
}
