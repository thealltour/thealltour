import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { HomeTaxonomyGrid } from "@/components/home/HomeTaxonomyGrid";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { cn } from "@/lib/cn";

export type DestinationSectionProps = {
  /** 홈에 노출할 destination 목록 (최대 8개 권장) */
  items: ProductTaxonomy[];
  className?: string;
};

/**
 * 홈 Destination 섹션.
 * 여행지 기반 탐색의 첫 진입점. 카드 그리드는 허브/목록과 재사용 가능한 구조.
 */
export default function DestinationSection({ items, className }: DestinationSectionProps) {
  if (items.length === 0) return null;

  return (
    <SectionBlock surface="none" padding="md" className={cn("space-y-4 sm:space-y-6", className)}>
      <SectionHeader
        eyebrow="DESTINATIONS"
        title="어디로 떠나고 싶으신가요?"
        description="지역별 여행 상품을 만나보세요."
        align="left"
      />
      <HomeTaxonomyGrid items={items} type="destination" layout="horizontal-scroll" className="mt-6" />
    </SectionBlock>
  );
}
