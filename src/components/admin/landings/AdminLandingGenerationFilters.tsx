"use client";

import type { LandingGenerationFilterType } from "@/types/adminLanding";

type Props = {
  taxonomyType: LandingGenerationFilterType;
  onlyNotGenerated: boolean;
  onTaxonomyTypeChange: (value: LandingGenerationFilterType) => void;
  onOnlyNotGeneratedChange: (value: boolean) => void;
  disabled?: boolean;
};

export default function AdminLandingGenerationFilters({
  taxonomyType,
  onlyNotGenerated,
  onTaxonomyTypeChange,
  onOnlyNotGeneratedChange,
  disabled,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <span>유형</span>
        <select
          value={taxonomyType}
          onChange={(e) =>
            onTaxonomyTypeChange(e.target.value as LandingGenerationFilterType)
          }
          disabled={disabled}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text-primary)]"
        >
          <option value="all">전체</option>
          <option value="destination">지역</option>
          <option value="destination_golf">골프 지역 랜딩</option>
          <option value="theme">테마</option>
          <option value="product_line">상품군</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <input
          type="checkbox"
          checked={onlyNotGenerated}
          onChange={(e) => onOnlyNotGeneratedChange(e.target.checked)}
          disabled={disabled}
        />
        <span>랜딩 미생성만 보기</span>
      </label>
    </div>
  );
}
