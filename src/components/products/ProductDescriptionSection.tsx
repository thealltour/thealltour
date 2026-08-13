"use client";

import { useMemo, useState } from "react";

const PLACEHOLDER_DESCRIPTION = "상품 설명을 확인해 주세요.";
const COLLAPSE_LINE_LIMIT = 12;
const COLLAPSE_CHAR_LIMIT = 800;

export function shouldShowProductDescription(description: string | null | undefined): boolean {
  const trimmed = description?.trim() ?? "";
  return trimmed.length > 0 && trimmed !== PLACEHOLDER_DESCRIPTION;
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

export type ProductDescriptionSectionProps = {
  description?: string | null;
};

export function ProductDescriptionSection({ description }: ProductDescriptionSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const text = useMemo(() => description?.replace(/\r\n/g, "\n").trim() ?? "", [description]);
  const collapsible = useMemo(() => needsDescriptionCollapse(text), [text]);
  const body = !collapsible || expanded ? text : collapsedPreview(text);

  if (!shouldShowProductDescription(text)) return null;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 md:p-5"
      aria-label="상품 소개"
    >
      <h2 className="mb-4 text-lg font-bold text-[var(--primary)]">상품 소개</h2>
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
          {expanded ? "접기" : "더보기"}
        </button>
      ) : null}
    </section>
  );
}
