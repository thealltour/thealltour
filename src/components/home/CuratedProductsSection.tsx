import { cn } from "@/lib/cn";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  SECTION_HEADER_MOBILE_CTA_CLASS,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { HomeSectionMoreLink } from "@/components/home/HomeSectionMoreLink";
import { CuratedSectionScrollBlock } from "@/components/home/CuratedSectionScrollBlock";
import { HomeTravelPathways } from "@/components/home/HomeTravelPathways";
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
  /** 추천 제목 옆 골프·패키지·맞춤견적 바로가기 */
  pathwayGolfHref?: string;
  plannerEnabled?: boolean;
};

/**
 * 홈 Curated Products 섹션.
 * 배너 바로 아래 추천상품. 데스크톱 4열 / 모바일 2열 그리드.
 */
export default function CuratedProductsSection({
  settings,
  sections,
  className,
  pathwayGolfHref,
  plannerEnabled,
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
        <div className="flex flex-col gap-3 sm:gap-4">
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
          {pathwayGolfHref ? (
            <HomeTravelPathways
              golfHref={pathwayGolfHref}
              plannerEnabled={plannerEnabled}
              variant="inline"
            />
          ) : null}
        </div>

        <div className="mx-auto mt-4 flex w-full max-w-[1344px] flex-col gap-4 md:mt-5">
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
