"use client";

import type { HomeCuratedSectionWithCount } from "@/types/homeCurated";

export type HomeCuratedSectionEditForm = {
  title: string;
  description: string;
  sort_order: number;
  max_items: number;
  is_active: boolean;
};

export type HomeCuratedSectionsPanelProps = {
  sections: HomeCuratedSectionWithCount[];
  selectedSectionId: string | null;
  editingSectionId: string | null;
  editingForm: HomeCuratedSectionEditForm;
  pendingDeleteSectionId: string | null;
  isSaving: boolean;
  onSelectSection: (sectionId: string) => void;
  onCreateSection: () => void;
  onStartEdit: (sectionId: string) => void;
  onCancelEdit: () => void;
  onChangeEditingField: (name: keyof HomeCuratedSectionEditForm, value: string | number | boolean) => void;
  onUpdateSection: (sectionId: string) => void;
  onRequestDelete: (sectionId: string) => void;
  onConfirmDelete: (sectionId: string) => void;
  onCancelDelete: () => void;
  onMoveSectionUp: (sectionId: string) => void;
  onMoveSectionDown: (sectionId: string) => void;
  /** 섹션별 메인 홈 노출 토글 (해당 섹션을 메인 홈에 노출할지) */
  onToggleSectionHomeExposure?: (sectionId: string, enabled: boolean) => void;
};

export default function HomeCuratedSectionsPanel({
  sections,
  selectedSectionId,
  editingSectionId,
  editingForm,
  pendingDeleteSectionId,
  isSaving,
  onSelectSection,
  onCreateSection,
  onStartEdit,
  onCancelEdit,
  onChangeEditingField,
  onUpdateSection,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onMoveSectionUp,
  onMoveSectionDown,
  onToggleSectionHomeExposure,
}: HomeCuratedSectionsPanelProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">추천 섹션 목록</p>
        <button
          type="button"
          onClick={onCreateSection}
          disabled={isSaving}
          className="rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]/80 disabled:opacity-50"
        >
          + 섹션 추가
        </button>
      </div>
      {sections.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">등록된 섹션이 없습니다. 섹션을 추가한 뒤 섹션별 상품을 구성할 수 있습니다.</p>
      ) : (
        <ul className="space-y-2">
          {sections.map((sec, idx) => (
            <li
              key={sec.id}
              className={`rounded-lg border p-3 ${
                selectedSectionId === sec.id
                  ? "border-[var(--primary)] bg-[var(--primary-soft)]/30"
                  : "border-[var(--border)] bg-[var(--surface-muted)]"
              }`}
            >
              {editingSectionId === sec.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editingForm.title}
                    onChange={(e) => onChangeEditingField("title", e.target.value)}
                    className="w-full rounded border border-[var(--border)] px-2 py-1 text-sm"
                    placeholder="제목"
                  />
                  <input
                    type="text"
                    value={editingForm.description}
                    onChange={(e) => onChangeEditingField("description", e.target.value)}
                    className="w-full rounded border border-[var(--border)] px-2 py-1 text-sm"
                    placeholder="설명"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateSection(sec.id)}
                      disabled={isSaving}
                      className="rounded border border-[var(--primary)] bg-[var(--primary)] px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="cursor-pointer"
                    onClick={() => onSelectSection(sec.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onSelectSection(sec.id)}
                  >
                    <p className="font-medium text-[var(--text-primary)]">{sec.title || "(제목 없음)"}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      순서 {sec.sort_order} · 상품 {sec.product_count}개
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {typeof onToggleSectionHomeExposure === "function" ? (
                      <label className="flex cursor-pointer items-center gap-1.5 rounded border border-[var(--border)] px-2 py-1 text-[10px] hover:bg-[var(--surface-muted)]">
                        <input
                          type="checkbox"
                          checked={sec.is_active}
                          onChange={(e) => {
                            e.stopPropagation();
                            onToggleSectionHomeExposure(sec.id, e.target.checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isSaving}
                          className="h-3.5 w-3.5 accent-[var(--primary)]"
                          aria-label={`${sec.title || "섹션"} 메인 홈 노출`}
                        />
                        <span className={sec.is_active ? "text-[var(--primary)] font-semibold" : "text-[var(--text-muted)]"}>
                          메인 홈 노출
                        </span>
                      </label>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)]">{sec.is_active ? "노출" : "숨김"}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onStartEdit(sec.id)}
                      disabled={isSaving}
                      className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveSectionUp(sec.id)}
                      disabled={isSaving || idx === 0}
                      className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                    >
                      위로
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveSectionDown(sec.id)}
                      disabled={isSaving || idx === sections.length - 1}
                      className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                    >
                      아래로
                    </button>
                    {pendingDeleteSectionId === sec.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onConfirmDelete(sec.id)}
                          disabled={isSaving}
                          className="rounded border border-[var(--danger)] px-2 py-0.5 text-[10px] text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                        >
                          삭제 확인
                        </button>
                        <button
                          type="button"
                          onClick={onCancelDelete}
                          className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px]"
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRequestDelete(sec.id)}
                        disabled={isSaving}
                        className="rounded border border-[var(--danger)]/50 px-2 py-0.5 text-[10px] text-[var(--danger)] hover:bg-[var(--danger-bg)] disabled:opacity-50"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
