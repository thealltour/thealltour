import Link from "next/link";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader, SECTION_HEADER_MOBILE_CTA_CLASS } from "@/components/layout/SectionHeader";
import { HomeTaxonomyGrid } from "@/components/home/HomeTaxonomyGrid";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { cn } from "@/lib/cn";

export type DestinationSectionProps = {
  /** 홈에 노출할 destination 목록 (최대 8개 권장) */
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
 * 홈 Destination 섹션.
 * 여행지 기반 탐색의 첫 진입점. 카드 그리드는 허브/목록과 재사용 가능한 구조.
 */
export default function DestinationSection({
  items,
  eyebrow,
  title,
  description,
  className,
}: DestinationSectionProps) {
  if (items.length === 0) return null;

  return (
    <SectionBlock
      surface="none"
      padding="md"
      className={cn("space-y-1.5 sm:space-y-4 !p-3 sm:!p-6 md:!p-8", className)}
    >
      <SectionHeader
        eyebrow={eyebrow?.trim() || undefined}
        title={title?.trim() || undefined}
        description={description?.trim() || undefined}
        align="left"
        action={
          <Link
            href="/destinations"
            className={SECTION_HEADER_MOBILE_CTA_CLASS}
            aria-label="인기 여행지 더보기"
          >
            더보기
            <span aria-hidden>→</span>
          </Link>
        }
      />
      <HomeTaxonomyGrid items={items} type="destination" layout="horizontal-scroll" />
    </SectionBlock>
  );
}
