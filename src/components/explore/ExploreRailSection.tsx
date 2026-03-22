"use client";

import type { ReactNode } from "react";
import { SectionBlock } from "@/components/layout/SectionBlock";
import type { SectionBlockPadding, SectionBlockSurface } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { cn } from "@/lib/cn";
import { ExploreTaxonomyList, type ExploreTaxonomyType } from "@/components/explore/ExploreTaxonomyList";

export type ExploreRailGroup = {
  key: string;
  ariaLabel: string;
  items: ProductTaxonomy[];
};

export type ExploreRailSectionProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  titleId?: string;
  hideEyebrowOnTablet?: boolean;
  action?: ReactNode;
  taxonomyType: ExploreTaxonomyType;
  layoutPreset: "home" | "hub";
  /** 단일 목록일 때 (groups 미사용) */
  items?: ProductTaxonomy[];
  listAriaLabel?: string;
  /** 허브처럼 해외/국내 등 다중 레일 */
  groups?: ExploreRailGroup[];
  surface?: SectionBlockSurface;
  padding?: SectionBlockPadding;
  sectionBlockClassName?: string;
  /** 그룹 사이 간격·구분선 래퍼 */
  groupsWrapperClassName?: string;
};

function listLabel(type: ExploreTaxonomyType, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  if (type === "destination") return "지역별 탐색";
  if (type === "theme") return "테마별 탐색";
  return "상품군별 탐색";
}

/**
 * 홈·/destinations·/themes 공통: 섹션 헤더 + ExploreTaxonomyList(레일/그리드).
 */
export function ExploreRailSection({
  title,
  description,
  eyebrow,
  titleId,
  hideEyebrowOnTablet,
  action,
  taxonomyType,
  layoutPreset,
  items,
  listAriaLabel,
  groups,
  surface = "none",
  padding = "md",
  sectionBlockClassName,
  groupsWrapperClassName,
}: ExploreRailSectionProps) {
  const hasGroups = groups && groups.length > 0;
  const hasItems = items && items.length > 0;
  if (!hasGroups && !hasItems) return null;

  return (
    <SectionBlock surface={surface} padding={padding} className={sectionBlockClassName}>
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        titleId={titleId}
        hideEyebrowOnTablet={hideEyebrowOnTablet}
        align="left"
        action={action}
      />

      {hasGroups ? (
        <div className={cn("flex flex-col gap-10", groupsWrapperClassName)}>
          {groups!.flatMap((g, index) => {
            const list = (
              <ExploreTaxonomyList
                key={g.key}
                items={g.items}
                taxonomyType={taxonomyType}
                layoutPreset={layoutPreset}
                listAriaLabel={g.ariaLabel}
              />
            );
            if (index === 0) return [list];
            return [
              <div
                key={`${g.key}-sep`}
                className="w-full border-t border-[var(--border)]"
                aria-hidden
              />,
              list,
            ];
          })}
        </div>
      ) : (
        <ExploreTaxonomyList
          items={items!}
          taxonomyType={taxonomyType}
          layoutPreset={layoutPreset}
          listAriaLabel={listLabel(taxonomyType, listAriaLabel)}
        />
      )}
    </SectionBlock>
  );
}
