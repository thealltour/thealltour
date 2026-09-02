import { cn } from "@/lib/cn";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  SECTION_HEADER_MOBILE_CTA_CLASS,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { HomeSectionMoreLink } from "@/components/home/HomeSectionMoreLink";
import { CuratedSectionScrollBlock } from "@/components/home/CuratedSectionScrollBlock";
import { resolveHomeCuratedSectionTitle } from "@/lib/homeCuratedSectionTitle";
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
    const headerTitle = resolveHomeCuratedSectionTitle(settings!, sections);

    return (
      <SectionBlock
        surface="none"
        padding="md"
        className={cn(HOME_MAIN_SECTION_BLOCK_CLASS, className)}
      >
        <SectionHeader
          eyebrow={settings!.section_label?.trim() || undefined}
          title={headerTitle}
          description={settings!.section_description?.trim() || undefined}
          action={
            <HomeSectionMoreLink
              href="/recommended"
              section="curated"
              label="더보기"
              className={SECTION_HEADER_MOBILE_CTA_CLASS}
              ariaLabel="THEALL PICKS 더보기"
            >
              더보기
              <span aria-hidden>→</span>
            </HomeSectionMoreLink>
          }
        />

        <div className="mx-auto flex w-full max-w-[1344px] flex-col gap-4">
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

  return null;
}
