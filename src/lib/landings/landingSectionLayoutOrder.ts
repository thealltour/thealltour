import type { AdminLandingSection } from "@/types/adminLanding";

/**
 * 퍼블릭/프리뷰 랜딩: 상품 노출 우선 · 상담 보조 흐름.
 * 동일 우선순위에서는 DB sort_order로 정렬.
 */
const SECTION_LAYOUT_PRIORITY: Record<string, number> = {
  hero: 0,
  intro: 20,
  cta: 30,
  consulting_points: 40,
  recommended_targets: 40,
  faq: 50,
};

function layoutPriority(sectionType: string): number {
  return SECTION_LAYOUT_PRIORITY[sectionType] ?? 45;
}

export function sortLandingSectionsForLayout(sections: AdminLandingSection[]): AdminLandingSection[] {
  return [...sections].sort((a, b) => {
    const pa = layoutPriority(String(a.sectionType));
    const pb = layoutPriority(String(b.sectionType));
    if (pa !== pb) return pa - pb;
    return a.sortOrder - b.sortOrder;
  });
}
