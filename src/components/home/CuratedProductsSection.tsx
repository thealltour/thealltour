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

/** 데스크톱 4열을 채울 수 있는 섹션을 앞에 둔다. 운영 순서는 home_curated_sections.sort_order. */
export function orderCuratedSectionsForHome(
  sections: HomeCuratedSectionWithProducts[],
): HomeCuratedSectionWithProducts[] {
  if (sections.length <= 1) return sections;
  return sections
    .map((section, index) => ({ section, index, count: section.products?.length ?? 0 }))
    .sort((a, b) => {
      const aFull = a.count >= 4 ? 1 : 0;
      const bFull = b.count >= 4 ? 1 : 0;
      if (aFull !== bFull) return bFull - aFull;
      if (a.count !== b.count) return b.count - a.count;
      return a.index - b.index;
    })
    .map((entry) => entry.section);
}

export type CuratedProductsSectionProps = {
  /** home_curated 설정 (비활성 또는 없으면 빈 상태 노출) */
  settings: HomeCuratedSettings | null;
  /** 추천 섹션 목록 (상품 포함) */
  sections: HomeCuratedSectionWithProducts[];
  className?: string;
  /** 추천 제목 옆 골프·패키지·맞춤견적 바로가기 */
  pathwayGolfHref?: string;
  pathwayGolfDatesHref?: string | null;
  plannerEnabled?: boolean;
};

/**
 * 홈 Curated Products 섹션.
 * 배너 바로 아래 추천상품. 모바일 2열 / 데스크톱은 상품 수에 맞는 열.
 */
export default function CuratedProductsSection({
  settings,
  sections,
  className,
  pathwayGolfHref,
  pathwayGolfDatesHref = null,
  plannerEnabled,
}: CuratedProductsSectionProps) {
  const isActive = settings?.is_active === true && sections.length > 0;
  const hasMultipleSections = sections.length >= 2;

  if (isActive) {
    const headerTitle = resolveHomeCuratedSectionTitle(settings!, sections);
    const rawEyebrow = settings!.section_label?.trim() || "";
    // 제목과 같거나 레거시 THEALL PICKS 라벨은 숨김
    const eyebrow =
      rawEyebrow &&
      rawEyebrow.toLowerCase() !== headerTitle.toLowerCase() &&
      !/^theall\s*picks$/i.test(rawEyebrow)
        ? rawEyebrow
        : undefined;
    const description = settings!.section_description?.trim() || undefined;

    return (
      <SectionBlock
        surface="none"
        padding="md"
        className={cn(
          HOME_MAIN_SECTION_BLOCK_CLASS,
          // PageContainer wide와 배너 좌우 기준선 맞춤 — 데스크톱 가로 패딩 제거
          "!py-1 sm:!py-1.5 md:!px-0 md:!py-2",
          className,
        )}
      >
        <div className="flex flex-col gap-2 sm:gap-2.5">
          <SectionHeader
            eyebrow={eyebrow}
            title={headerTitle}
            description={description}
            action={
              <HomeSectionMoreLink
                href="/recommended"
                section="curated"
                label="더보기"
                className={SECTION_HEADER_MOBILE_CTA_CLASS}
                ariaLabel={`${headerTitle} 더보기`}
              >
                더보기
                <span aria-hidden>→</span>
              </HomeSectionMoreLink>
            }
          />
          {pathwayGolfHref ? (
            <HomeTravelPathways
              golfHref={pathwayGolfHref}
              golfDatesHref={pathwayGolfDatesHref}
              plannerEnabled={plannerEnabled}
              variant="inline"
            />
          ) : null}
        </div>

        <div className="mx-auto mt-2.5 flex w-full flex-col gap-3.5 md:mt-3 md:gap-4">
          {orderCuratedSectionsForHome(sections).map((sec) => (
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
