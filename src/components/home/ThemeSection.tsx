import Link from "next/link";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  SECTION_HEADER_MOBILE_CTA_CLASS,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { HomeTaxonomyGrid } from "@/components/home/HomeTaxonomyGrid";
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
 * Destination 다음 단계의 탐색 축. 추후 product_taxonomies(theme) 연결 확장 용이.
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
    <SectionBlock
      surface="none"
      padding="md"
      className={cn(HOME_MAIN_SECTION_BLOCK_CLASS, className)}
    >
      <SectionHeader
        eyebrow={eyebrow?.trim() || undefined}
        title={title?.trim() || undefined}
        description={description?.trim() || undefined}
        hideEyebrowOnTablet
        align="left"
        action={
          <Link
            href="/themes"
            className={SECTION_HEADER_MOBILE_CTA_CLASS}
            aria-label="나만의 테마 여행 더보기"
          >
            더보기
            <span aria-hidden>→</span>
          </Link>
        }
      />
      <HomeTaxonomyGrid items={items} type="theme" layout="horizontal-scroll" />
    </SectionBlock>
  );
}
