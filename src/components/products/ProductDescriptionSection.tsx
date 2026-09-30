"use client";

import { useMemo, useState } from "react";
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

export function shouldShowDescriptionSection(
  description: string | null | undefined,
  golfCourseInfo: string | null | undefined,
): boolean {
  return shouldShowProductDescription(description) || shouldShowGolfCourseInfo(golfCourseInfo);
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

/** 밴드 본문의 연속 빈 줄이 접기 미리보기(12줄)를 잡아먹지 않도록 빈 줄은 한 줄까지만 남깁니다. */
function normalizePlainText(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ProductDescriptionSectionProps = {
  description?: string | null;
  /** 레거시 단일 텍스트. 골프장별 목록(golf_courses_json)은 골프장·호텔·관광지 사진 섹션에서 보여줍니다. */
  golfCourseInfo?: string | null;
  /** 가격 요약 카드 안에 붙일 때 사용. 단일 열·작은 제목, 모바일에서는 카드 테두리 없이 같은 면에 흐릅니다. */
  embedded?: boolean;
};

export function ProductDescriptionSection({
  description,
  golfCourseInfo,
  embedded = false,
}: ProductDescriptionSectionProps) {
  const descText = useMemo(() => normalizePlainText(description), [description]);
  const golfText = useMemo(() => normalizePlainText(golfCourseInfo), [golfCourseInfo]);
  const showDesc = shouldShowProductDescription(descText);
  const showGolf = shouldShowGolfCourseInfo(golfText);
  const twoCol = showDesc && showGolf;

  if (!showDesc && !showGolf) return null;

  const ariaLabel = twoCol ? "상품 소개와 골프장 정보" : showGolf ? "골프장 정보" : "상품 소개";

  if (embedded) {
    const headingClass = "mb-2 text-sm font-bold text-[var(--primary)]";
    return (
      <section
        className="space-y-4 md:rounded-lg md:border md:border-slate-200/90 md:bg-white/90 md:p-4"
        aria-label={ariaLabel}
      >
        {showDesc ? (
          <div>
            <h2 className={headingClass}>상품 소개</h2>
            <CollapsiblePlainText text={descText} expandLabel="더보기" />
          </div>
        ) : null}
        {showGolf ? (
          <div className={twoCol ? "border-t border-slate-200 pt-4" : undefined}>
            <h2 className={headingClass}>골프장 정보</h2>
            <CollapsiblePlainText text={golfText} expandLabel="더보기" />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 md:p-5"
      aria-label={ariaLabel}
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
            <CollapsiblePlainText text={golfText} expandLabel="더보기" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
