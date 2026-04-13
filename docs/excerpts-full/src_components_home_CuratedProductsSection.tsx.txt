import Link from "next/link";
import { cn } from "@/lib/cn";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  SECTION_HEADER_MOBILE_CTA_CLASS,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { CuratedSectionScrollBlock } from "@/components/home/CuratedSectionScrollBlock";
import type {
  HomeCuratedSettings,
  HomeCuratedSectionWithProducts,
} from "@/types/homeCurated";

export type CuratedProductsSectionProps = {
  /** home_curated 설정 (비활성 또는 없으면 빈 상태 노출) */
  settings: HomeCuratedSettings | null;
  /** 추천 섹션 목록 (상품 포함) */
  sections: HomeCuratedSectionWithProducts[];
  className?: string;
};

/**
 * 홈 Curated Products 섹션.
 * Theme 아래에 위치. 노출 설정된 추천 섹션을 sort_order 순서대로 블록 단위로 노출.
 * 각 섹션은 지역·테마와 동일한 가로 스크롤 + 좌/우 버튼 UX.
 */
export default function CuratedProductsSection({
  settings,
  sections,
  className,
}: CuratedProductsSectionProps) {
  const isActive = settings?.is_active === true && sections.length > 0;
  const hasMultipleSections = sections.length >= 2;

  if (isActive) {
    return (
      <SectionBlock
        surface="none"
        padding="md"
        className={cn(HOME_MAIN_SECTION_BLOCK_CLASS, className)}
      >
        <SectionHeader
          eyebrow={settings!.section_label?.trim() || undefined}
          title={settings!.section_title}
          description={settings!.section_description}
          action={
            <Link
              href="/recommended"
              className={SECTION_HEADER_MOBILE_CTA_CLASS}
              aria-label="THEALL PICKS 더보기"
            >
              더보기
              <span aria-hidden>→</span>
            </Link>
          }
        />

        <div className="mx-auto flex w-full max-w-[1344px] flex-col gap-8 max-md:gap-10">
          {sections.map((sec) => (
            <CuratedSectionScrollBlock
              key={sec.id}
              section={sec}
              showTitle={hasMultipleSections}
            />
          ))}
        </div>
      </SectionBlock>
    );
  }

  return (
    <SectionBlock
      surface="card"
      padding="md"
      className={cn("!px-4 !py-3 sm:!p-6 md:!p-8", className)}
    >
      <p className="type-small text-[var(--text-muted)]">
        메인 추천 상품이 없습니다. 관리자 페이지에서 추천 상품을 체크해 주세요.
      </p>
    </SectionBlock>
  );
}
