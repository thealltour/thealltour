import Link from "next/link";
import CuratedBlock from "@/components/home/CuratedBlock";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
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
 * Theme 아래에 위치. home_curated 기반 추천 상품 노출.
 * 실제 데이터 정교한 연결은 후속 PR에서 확장 가능.
 */
export default function CuratedProductsSection({
  settings,
  sections,
  className,
}: CuratedProductsSectionProps) {
  const isActive = settings?.is_active === true && sections.length > 0;

  if (isActive) {
    return (
      <SectionBlock surface="none" padding="md" className={className}>
        <SectionHeader
          eyebrow={settings!.section_label}
          title={settings!.section_title}
          description={settings!.section_description}
        />
        <div className="space-y-8">
          {sections.map((sec) => (
            <CuratedBlock
              key={sec.id}
              title={sec.title}
              description={sec.description}
              products={sec.products}
            />
          ))}
          <div className="pt-2">
            <Link
              href={settings!.catalog_button_href}
              className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
            >
              {settings!.catalog_button_label}
            </Link>
          </div>
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
