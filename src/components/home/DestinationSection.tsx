import Link from "next/link";
import {
  SECTION_HEADER_MOBILE_CTA_CLASS,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { ExploreRailSection } from "@/components/explore/ExploreRailSection";
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
 * `ExploreRailSection` + `ExploreCategoryCard` — /destinations 허브와 동일 카드·레일 UX.
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
    <ExploreRailSection
      layoutPreset="home"
      surface="none"
      padding="md"
      sectionBlockClassName={cn(HOME_MAIN_SECTION_BLOCK_CLASS, className)}
      eyebrow={eyebrow?.trim() || undefined}
      title={title?.trim() || undefined}
      description={description?.trim() || undefined}
      hideEyebrowOnTablet
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
      taxonomyType="destination"
      items={items}
      listAriaLabel="지역별 탐색"
    />
  );
}
