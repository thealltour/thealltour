"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

export type SectionIssueForPanel = {
  severity: "required" | "recommended";
  message: string;
  anchorId?: string;
};

export type ProductFormSectionIssuesPanelProps = {
  /** 현재 섹션 id (스크롤용) */
  sectionId: string;
  /** 이 섹션의 이슈 목록 */
  sectionIssues: SectionIssueForPanel[];
  /** 항목 클릭 시: anchorId가 있으면 해당 필드로 스크롤+포커스, 없으면 섹션 상단으로만 스크롤 */
  onIssueClick: (anchorId: string | undefined) => void;
};

export function ProductFormSectionIssuesPanel({
  sectionId,
  sectionIssues,
  onIssueClick,
}: ProductFormSectionIssuesPanelProps) {
  const [showRecommended, setShowRecommended] = useState(false);
  const requiredIssues = sectionIssues.filter((i) => i.severity === "required");
  const recommendedIssues = sectionIssues.filter((i) => i.severity === "recommended");
  const hasRequired = requiredIssues.length > 0;
  const hasRecommended = recommendedIssues.length > 0;
  const total = requiredIssues.length + recommendedIssues.length;

  if (total === 0) return null;

  const title = hasRequired
    ? `누락 항목(필수 ${requiredIssues.length}개)`
    : hasRecommended
      ? `권장 항목(${recommendedIssues.length}개)`
      : null;
  if (!title) return null;

  return (
    <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <p
        className={`mb-2 text-xs font-semibold ${
          hasRequired ? "text-[var(--danger)]" : "text-amber-800 dark:text-amber-200"
        }`}
      >
        {title}
      </p>
      <ul className="space-y-1">
        {requiredIssues.map((issue, idx) => (
          <li key={`req-${idx}-${issue.message}`}>
            <button
              type="button"
              onClick={() => onIssueClick(issue.anchorId)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--danger)]" aria-hidden />
                <span className="truncate">{issue.message}</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--danger)]" aria-hidden />
            </button>
          </li>
        ))}
        {hasRecommended && (
          <>
            {showRecommended ? (
              recommendedIssues.map((issue, idx) => (
                <li key={`rec-${idx}-${issue.message}`}>
                  <button
                    type="button"
                    onClick={() => onIssueClick(issue.anchorId)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warning)]"
                        aria-hidden
                      />
                      <span className="truncate">{issue.message}</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden />
                  </button>
                </li>
              ))
            ) : (
              <li>
                <button
                  type="button"
                  onClick={() => setShowRecommended(true)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                >
                  권장 {recommendedIssues.length}개 보기
                </button>
              </li>
            )}
          </>
        )}
      </ul>
    </div>
  );
}
