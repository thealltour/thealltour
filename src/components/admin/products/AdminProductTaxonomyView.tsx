"use client";

import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";

export type AdminProductTaxonomyViewProps = {
  categoryTaxonomies: ProductTaxonomyWithUsage[];
  themeTaxonomies: ProductTaxonomyWithUsage[];
  hasFallbackItems: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  newCategoryInput: string;
  newThemeInput: string;
  pendingCreateType: "category" | "theme" | null;
  pendingDeleteId: string | null;
  onCategoryInputChange: (value: string) => void;
  onThemeInputChange: (value: string) => void;
  onCreateCategory: () => void;
  onCreateTheme: () => void;
  onDeleteTaxonomy: (item: ProductTaxonomyWithUsage) => void;
};

export default function AdminProductTaxonomyView({
  categoryTaxonomies,
  themeTaxonomies,
  hasFallbackItems,
  errorMessage,
  isLoading,
  newCategoryInput,
  newThemeInput,
  pendingCreateType,
  pendingDeleteId,
  onCategoryInputChange,
  onThemeInputChange,
  onCreateCategory,
  onCreateTheme,
  onDeleteTaxonomy,
}: AdminProductTaxonomyViewProps) {
  return (
    <section className="space-y-3 rounded-xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--border)]">
      <h3 className="text-lg font-bold text-[var(--primary)]">카테고리/테마 관리</h3>
      {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}
      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">분류 목록을 불러오는 중입니다...</p>
      ) : (
        <div className="space-y-3">
          {hasFallbackItems ? (
            <p className="text-xs text-amber-700">
              분류 전용 테이블이 없어 임시 목록으로 표시 중입니다. SQL 적용 후 추가/삭제가 완전 활성화됩니다.
            </p>
          ) : null}
          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">카테고리</p>
              <div className="flex flex-wrap gap-2">
                {categoryTaxonomies.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"
                  >
                    {item.name}
                    <span className="text-[10px] text-blue-600">({item.usageCount})</span>
                    <button
                      type="button"
                      disabled={pendingDeleteId === item.id || item.id.startsWith("fallback-")}
                      onClick={() => onDeleteTaxonomy(item)}
                      className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-1.5 py-0.5 text-[10px] text-[var(--danger)] ring-1 ring-[var(--danger)]/30 hover:opacity-90 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={newCategoryInput}
                  onChange={(e) => onCategoryInputChange(e.target.value)}
                  placeholder="카테고리 직접 추가"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                />
                <button
                  type="button"
                  onClick={onCreateCategory}
                  disabled={pendingCreateType === "category"}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
                >
                  {pendingCreateType === "category" ? "추가 중..." : "추가"}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">테마</p>
              <div className="flex flex-wrap gap-2">
                {themeTaxonomies.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                  >
                    {item.name}
                    <span className="text-[10px] text-amber-600">({item.usageCount})</span>
                    <button
                      type="button"
                      disabled={pendingDeleteId === item.id || item.id.startsWith("fallback-")}
                      onClick={() => onDeleteTaxonomy(item)}
                      className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-1.5 py-0.5 text-[10px] text-[var(--danger)] ring-1 ring-[var(--danger)]/30 hover:opacity-90 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={newThemeInput}
                  onChange={(e) => onThemeInputChange(e.target.value)}
                  placeholder="테마 직접 추가 (예: 가족여행)"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                />
                <button
                  type="button"
                  onClick={onCreateTheme}
                  disabled={pendingCreateType === "theme"}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
                >
                  {pendingCreateType === "theme" ? "추가 중..." : "추가"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
