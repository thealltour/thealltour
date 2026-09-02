"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { GolfCourseInfoItem } from "@/types/product";
import {
  collapsedPreview,
  needsDescriptionCollapse,
} from "@/lib/products/collapsiblePlainText";

const PLACEHOLDER_DESCRIPTION = "상품 설명을 확인해 주세요.";

export { needsDescriptionCollapse } from "@/lib/products/collapsiblePlainText";

export function shouldShowProductDescription(description: string | null | undefined): boolean {
  const trimmed = description?.trim() ?? "";
  return trimmed.length > 0 && trimmed !== PLACEHOLDER_DESCRIPTION;
}

export function shouldShowGolfCourseInfo(golfCourseInfo: string | null | undefined): boolean {
  return (golfCourseInfo?.trim() ?? "").length > 0;
}

function CollapsiblePlainText({ text, expandLabel }: { text: string; expandLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = needsDescriptionCollapse(text);
  const body = !collapsible || expanded ? text : collapsedPreview(text);

  return (
    <>
      <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
        {body}
        {collapsible && !expanded ? "…" : null}
      </div>
      {collapsible ? (
        <button
          type="button"
          className="mt-3 text-sm font-medium text-[var(--primary)] hover:underline"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "접기" : expandLabel}
        </button>
      ) : null}
    </>
  );
}

export type ProductDescriptionSectionProps = {
  description?: string | null;
  golfCourseInfo?: string | null;
  golfCourses?: GolfCourseInfoItem[] | null;
};

export function ProductDescriptionSection({
  description,
  golfCourseInfo,
  golfCourses,
}: ProductDescriptionSectionProps) {
  const descText = useMemo(() => description?.replace(/\r\n/g, "\n").trim() ?? "", [description]);
  const golfText = useMemo(
    () => golfCourseInfo?.replace(/\r\n/g, "\n").trim() ?? "",
    [golfCourseInfo],
  );
  const normalizedCourses = useMemo(
    () =>
      (golfCourses ?? [])
        .map((course) => ({
          name: course.name?.trim() ?? "",
          content: course.content?.trim() ?? "",
        }))
        .filter((course) => course.name.length > 0 && course.content.length > 0),
    [golfCourses],
  );
  const [activeCourseIndex, setActiveCourseIndex] = useState<number | null>(null);
  const activeCourse = activeCourseIndex != null ? normalizedCourses[activeCourseIndex] : null;
  const showDesc = shouldShowProductDescription(descText);
  const showGolf = normalizedCourses.length > 0 || shouldShowGolfCourseInfo(golfText);
  const twoCol = showDesc && showGolf;

  if (!showDesc && !showGolf) return null;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 md:p-5"
      aria-label={twoCol ? "상품 소개와 골프장 정보" : showGolf ? "골프장 정보" : "상품 소개"}
    >
      <div className={twoCol ? "grid gap-6 md:grid-cols-2 md:gap-8" : undefined}>
        {showDesc ? (
          <div>
            <h2 className="mb-4 text-lg font-bold text-[var(--primary)]">상품 소개</h2>
            <CollapsiblePlainText text={descText} expandLabel="더보기" />
          </div>
        ) : null}
        {showGolf ? (
          <div className={twoCol ? "md:border-l md:border-slate-200 md:pl-8" : undefined}>
            <h2 className="mb-4 text-lg font-bold text-[var(--primary)]">골프장 정보</h2>
            {normalizedCourses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {normalizedCourses.map((course, index) => (
                  <button
                    key={`${course.name}-${index}`}
                    type="button"
                    onClick={() => setActiveCourseIndex(index)}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
                  >
                    {course.name}
                  </button>
                ))}
              </div>
            ) : (
              <CollapsiblePlainText text={golfText} expandLabel="더보기" />
            )}
          </div>
        ) : null}
      </div>
      <Modal
        isOpen={activeCourse != null}
        onClose={() => setActiveCourseIndex(null)}
        aria-label={activeCourse ? `${activeCourse.name} 골프장 정보` : "골프장 정보"}
        className="w-full max-w-2xl"
      >
        {activeCourse ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{activeCourse.name}</h3>
              <button
                type="button"
                onClick={() => setActiveCourseIndex(null)}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                닫기
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
              {activeCourse.content}
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
