import {
  SECTION_HEADER_MOBILE_CTA_CLASS,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { HomeSectionMoreLink } from "@/components/home/HomeSectionMoreLink";
import { ExploreRailSection } from "@/components/explore/ExploreRailSection";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { cn } from "@/lib/cn";

export type ThemeSectionProps = {
  /** 홈에 노출할 theme 목록 (최대 8개 권장) */
  items: ProductTaxonomy[];
  /** 섹션 상단 라벨(eyebrow). 비어 있으면 메인에서 표시하지 않음 */
  eyebrow?: string | null;
  /** 섹션 제목. 비어 있으면 메인에서 표시하지 않음 */
  title?: string | null;
  /** 섹션 부제목. 비어 있으면 메인에서 표시하지 않음 */
  description?: string | null;
  className?: string;
};

/**
 * 홈 Theme 섹션.
 * `ExploreRailSection` + `ExploreCategoryCard` — /themes 허브와 동일 카드·레일 UX.
 */
export default function ThemeSection({
  items,
  eyebrow,
  title,
  description,
  className,
}: ThemeSectionProps) {
  if (items.length === 0) return null;

  return (
    <ExploreRailSection
      layoutPreset="home"
      surface="none"
      padding="md"
      sectionBlockClassName={cn(HOME_MAIN_SECTION_BLOCK_CLASS, className)}
      eyebrow={eyebrow?.trim() || undefined}
      title={title?.trim() || undefined}
      description={description?.trim() || undefined}
      action={
        <HomeSectionMoreLink
          href="/themes"
          section="theme"
          label="더보기"
          className={SECTION_HEADER_MOBILE_CTA_CLASS}
          ariaLabel="나만의 테마 여행 더보기"
        >
          더보기
          <span aria-hidden>→</span>
        </HomeSectionMoreLink>
      }
      taxonomyType="theme"
      items={items}
      listAriaLabel="테마별 탐색"
    />
  );
}
