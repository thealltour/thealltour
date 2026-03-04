"use client";

/** 액션 바에서 사용하는 이슈 타입 (AdminProductManager FormIssue와 호환) */
export type FormIssueForBar = {
  sectionId: string;
  severity: "required" | "recommended";
  message: string;
  anchorId?: string;
};

export type ProductFormActionBarProps = {
  /** 섹션 목록 (id, title) */
  sections: Array<{ id: string; title: string }>;
  /** 아코디언 열림 상태 */
  openSections: Record<string, boolean>;
  /** 아코디언 열림 설정 */
  setOpenSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** collectFormIssues(form) 결과 — 진행률/필수 누락 계산용 */
  issues: FormIssueForBar[];
  /** 저장(제출) 클릭 */
  onSave: () => void;
  /** 임시저장 클릭 */
  onTempSave: () => void;
  /** 미리보기로 이동 (선택) */
  onPreviewClick?: () => void;
  /** 복원 클릭 (선택, 배너는 상위에서 렌더) */
  onRestoreTemp?: () => void;
  /** 임시 저장본 존재 여부 */
  hasTempDraft?: boolean;
  /** 저장 API 제출 중 */
  isSaving?: boolean;
  /** 임시저장 처리 중 */
  isSavingDraft?: boolean;
  /** 수정 모드 여부 */
  isEditing?: boolean;
  /** 상단 고정 여부 (기본 true, 좌측 네비 아래에 둘 때 false) */
  sticky?: boolean;
};

export function ProductFormActionBar({
  sections,
  openSections,
  setOpenSections,
  issues,
  onSave,
  onTempSave,
  onPreviewClick,
  hasTempDraft = false,
  isSaving = false,
  isSavingDraft = false,
  isEditing = false,
  sticky = true,
}: ProductFormActionBarProps) {
  const sectionIds = sections.map((s) => s.id);
  const totalSections = sectionIds.length;
  const requiredIssues = issues.filter((i) => i.severity === "required");
  const requiredCount = requiredIssues.length;
  const completedSectionCount = sectionIds.filter(
    (id) => !issues.some((i) => i.sectionId === id && i.severity === "required"),
  ).length;

  const expandAll = () => {
    setOpenSections((prev) => {
      const next = { ...prev };
      sectionIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
  };

  const collapseAll = () => {
    setOpenSections((prev) => {
      const next = { ...prev };
      sectionIds.forEach((id) => {
        next[id] = false;
      });
      return next;
    });
  };

  return (
    <div
      id="product-form-actionbar"
      className={
        sticky
          ? "sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[var(--surface)]/80"
          : "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm"
      }
      role="toolbar"
      aria-label="상품 폼 액션"
    >
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--text-muted)]">
        <span>
          완료{" "}
          <span className="font-semibold text-[var(--text-primary)]">
            {completedSectionCount}/{totalSections}
          </span>
          {requiredCount > 0 ? (
            <>
              {" · "}
              필수 누락{" "}
              <span className="font-semibold text-[var(--danger)]">{requiredCount}</span>
            </>
          ) : null}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={expandAll}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            전체 펼치기
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            전체 접기
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onTempSave}
          disabled={isSavingDraft}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-60"
        >
          {isSavingDraft ? "저장 중…" : "임시저장"}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:opacity-60"
        >
          {isSaving ? "저장 중…" : isEditing ? "수정 저장" : "저장"}
        </button>
        {onPreviewClick ? (
          <button
            type="button"
            onClick={onPreviewClick}
            className="rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
          >
            미리보기로 이동
          </button>
        ) : null}
      </div>
    </div>
  );
}
