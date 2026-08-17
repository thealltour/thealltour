"use client";

import { useMemo, useState } from "react";

const PLACEHOLDER_DESCRIPTION = "상품 설명을 확인해 주세요.";
const COLLAPSE_LINE_LIMIT = 12;
const COLLAPSE_CHAR_LIMIT = 800;

export function shouldShowProductDescription(description: string | null | undefined): boolean {
  const trimmed = description?.trim() ?? "";
  return trimmed.length > 0 && trimmed !== PLACEHOLDER_DESCRIPTION;
}

export function shouldShowGolfCourseInfo(golfCourseInfo: string | null | undefined): boolean {
  return (golfCourseInfo?.trim() ?? "").length > 0;
}

export function needsDescriptionCollapse(text: string): boolean {
  const normalized = text.replace(/\r\n/g, "\n");
  return normalized.split("\n").length > COLLAPSE_LINE_LIMIT || normalized.length > COLLAPSE_CHAR_LIMIT;
}

function collapsedPreview(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").slice(0, COLLAPSE_LINE_LIMIT).join("\n");
  const clipped = lines.length > COLLAPSE_CHAR_LIMIT ? lines.slice(0, COLLAPSE_CHAR_LIMIT) : lines;
  return clipped.trimEnd();
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
};

export function ProductDescriptionSection({
  description,
  golfCourseInfo,
}: ProductDescriptionSectionProps) {
  const descText = useMemo(() => description?.replace(/\r\n/g, "\n").trim() ?? "", [description]);
  const golfText = useMemo(
    () => golfCourseInfo?.replace(/\r\n/g, "\n").trim() ?? "",
    [golfCourseInfo],
  );
  const showDesc = shouldShowProductDescription(descText);
  const showGolf = shouldShowGolfCourseInfo(golfText);
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
            <CollapsiblePlainText text={golfText} expandLabel="더보기" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
