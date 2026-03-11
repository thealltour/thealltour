import Link from "next/link";
import { cn } from "@/lib/cn";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader, SECTION_HEADER_CTA_CLASS } from "@/components/layout/SectionHeader";
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
      <SectionBlock surface="none" padding="md" className={cn("space-y-3 sm:space-y-4", className)}>
        <SectionHeader
          eyebrow={settings!.section_label}
          title={settings!.section_title}
          description={settings!.section_description}
          action={
            <Link
              href={settings!.catalog_button_href}
              className={SECTION_HEADER_CTA_CLASS}
            >
              {settings!.catalog_button_label}
            </Link>
          }
        />

        <div className="mx-auto w-full max-w-[1344px]">
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
    <SectionBlock surface="card" padding="md" className={className}>
      <p className="type-small text-[var(--text-muted)]">
        메인 추천 상품이 없습니다. 관리자 페이지에서 추천 상품을 체크해 주세요.
      </p>
    </SectionBlock>
  );
}
