"use client";

/** 네비에서 사용하는 이슈 타입 (FormIssue와 호환) */
export type FormIssueForNav = {
  sectionId: string;
  severity: "required" | "recommended";
  message?: string;
  anchorId?: string;
};

export type ProductFormSectionNavProps = {
  /** 섹션 목록 (순서 유지) */
  sections: Array<{ id: string; title: string }>;
  /** 현재 활성 섹션 (스크롤/observer로 갱신) */
  activeSectionId: string | null;
  /** 활성 섹션 설정 (클릭 시 호출, 선택) */
  setActiveSectionId?: (id: string) => void;
  /** 섹션 열기 + 스크롤 (anchorId 있으면 포커스까지) */
  openSection: (id: string, anchorId?: string) => void;
  /** collectFormIssues(form) 결과 — 뱃지 계산용 */
  issues: FormIssueForNav[];
};

function groupIssuesBySection(issues: FormIssueForNav[]): Record<string, { required: number; recommended: number }> {
  const out: Record<string, { required: number; recommended: number }> = {};
  for (const i of issues) {
    if (!out[i.sectionId]) out[i.sectionId] = { required: 0, recommended: 0 };
    if (i.severity === "required") out[i.sectionId].required += 1;
    else out[i.sectionId].recommended += 1;
  }
  return out;
}

/** 섹션 제목 짧게 (네비용) */
const SHORT_TITLES: Record<string, string> = {
  basic: "기본",
  price: "가격",
  description: "설명",
  included: "포함",
  schedule: "일정",
  flight: "항공",
  terms: "약관·SEO",
};

export function ProductFormSectionNav({
  sections,
  activeSectionId,
  setActiveSectionId,
  openSection,
  issues,
}: ProductFormSectionNavProps) {
  const issueCounts = groupIssuesBySection(issues);
  const totalRequired = issues.filter((i) => i.severity === "required").length;

  function handleClick(sectionId: string) {
    setActiveSectionId?.(sectionId);
    openSection(sectionId);
  }

  return (
    <nav
      className="flex shrink-0 flex-col gap-1.5"
      aria-label="폼 섹션 목차"
    >
      {/* 모바일: 가로 스크롤 pill — 상위에서 sticky 적용 */}
      <div className="flex flex-col gap-1.5 sticky top-14 z-10 md:hidden">
        <p className={`text-[11px] font-semibold ${totalRequired > 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
          {totalRequired > 0 ? `필수 누락: ${totalRequired}개` : "필수 완료"}
        </p>
      <div className="flex overflow-x-auto gap-1.5 pb-2 scrollbar-thin">
        {sections.map((section) => {
          const counts = issueCounts[section.id] ?? { required: 0, recommended: 0 };
          const badgeLabel =
            counts.required > 0
              ? `필수 ${counts.required}`
              : counts.recommended > 0
                ? `권장 ${counts.recommended}`
                : "완료";
          const badgeVariant =
            counts.required > 0 ? "required" : counts.recommended > 0 ? "recommended" : "complete";
          const isActive = activeSectionId === section.id;
          const shortTitle = SHORT_TITLES[section.id] ?? section.title;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => handleClick(section.id)}
              aria-current={isActive ? "true" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition md:rounded-md md:border-0 md:px-2 md:py-1.5 ${
                isActive
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {counts.required > 0 ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--danger)]" aria-hidden />
              ) : null}
              <span>{shortTitle}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  badgeVariant === "complete"
                    ? "bg-[var(--success)]/20 text-[var(--success)]"
                    : badgeVariant === "required"
                      ? "bg-[var(--danger)]/20 text-[var(--danger)]"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                }`}
              >
                {badgeLabel}
              </span>
            </button>
          );
        })}
      </div>
      </div>

      {/* 데스크톱: 좌측 세로 목차 — 상위 sticky 래퍼에서 top/scroll 적용 */}
      <div className="hidden md:block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-sm">
        <p className={`mb-2 text-[11px] font-semibold ${totalRequired > 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
          {totalRequired > 0 ? `필수 누락: ${totalRequired}개` : "필수 완료"}
        </p>
        <div className="flex flex-col gap-0.5">
          {sections.map((section) => {
            const counts = issueCounts[section.id] ?? { required: 0, recommended: 0 };
            const badgeLabel =
              counts.required > 0
                ? `필수 ${counts.required}`
                : counts.recommended > 0
                  ? `권장 ${counts.recommended}`
                  : "완료";
            const badgeVariant =
              counts.required > 0 ? "required" : counts.recommended > 0 ? "recommended" : "complete";
            const isActive = activeSectionId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => handleClick(section.id)}
                aria-current={isActive ? "true" : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-md border-l-2 py-1.5 pl-2 pr-2 text-left text-sm transition ${
                  isActive
                    ? "border-l-[var(--primary)] bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
                    : "border-l-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {counts.required > 0 ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--danger)]" aria-hidden />
                ) : null}
                <span className="min-w-0 truncate">{section.title}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    badgeVariant === "complete"
                      ? "bg-[var(--success)]/20 text-[var(--success)]"
                      : badgeVariant === "required"
                        ? "bg-[var(--danger)]/20 text-[var(--danger)]"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {badgeLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
