import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { HomeTaxonomyGrid } from "@/components/home/HomeTaxonomyGrid";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { cn } from "@/lib/cn";

export type ThemeSectionProps = {
  /** 홈에 노출할 theme 목록 (최대 8개 권장) */
  items: ProductTaxonomy[];
  className?: string;
};

/**
 * 홈 Theme 섹션.
 * Destination 다음 단계의 탐색 축. 추후 product_taxonomies(theme) 연결 확장 용이.
 */
export default function ThemeSection({ items, className }: ThemeSectionProps) {
  if (items.length === 0) return null;

  return (
    <SectionBlock surface="none" padding="md" className={cn("space-y-4 sm:space-y-6", className)}>
      <SectionHeader
        eyebrow="TRAVEL THEMES"
        title="이런 여행은 어떠세요?"
        description="테마별로 여행 상품을 둘러보세요."
        align="left"
      />
      <HomeTaxonomyGrid items={items} type="theme" className="mt-6" />
    </SectionBlock>
  );
}
