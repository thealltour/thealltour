"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { AutolinkPlainText } from "@/lib/products/autolinkPlainText";
import {
  needsDescriptionCollapse,
  previewNoticeLines,
} from "@/lib/products/collapsiblePlainText";

export type CollapsibleNoticeLinesProps = {
  lines: string[];
  className?: string;
  listClassName?: string;
  expandLabel?: string;
  collapseLabel?: string;
};

/**
 * PDP notice bullet list — collapsible long copy, per-line URL autolink, ul/li semantics.
 */
export function CollapsibleNoticeLines({
  lines,
  className,
  listClassName,
  expandLabel = "내용 더보기",
  collapseLabel = "접기",
}: CollapsibleNoticeLinesProps) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const fullText = useMemo(() => lines.join("\n"), [lines]);
  const collapsible = useMemo(() => needsDescriptionCollapse(fullText), [fullText]);

  const { displayLines, showTrailingEllipsis } = useMemo(() => {
    if (!collapsible || expanded) {
      return { displayLines: lines, showTrailingEllipsis: false };
    }
    const preview = previewNoticeLines(lines);
    return {
      displayLines: preview.lines,
      showTrailingEllipsis: preview.hasMore,
    };
  }, [lines, collapsible, expanded]);

  if (lines.length === 0) return null;

  return (
    <div className={cn("min-w-0", className)}>
      <ul
        id={contentId}
        className={cn(
          "mt-2 min-w-0 space-y-2 text-base leading-[1.7] text-slate-700",
          listClassName,
        )}
      >
        {displayLines.map((line, index) => (
          <li
            key={`${index}-${line.slice(0, 24)}`}
            className="min-w-0 break-words [overflow-wrap:anywhere]"
          >
            <AutolinkPlainText text={line} />
            {showTrailingEllipsis && index === displayLines.length - 1 ? "…" : null}
          </li>
        ))}
      </ul>
      {collapsible ? (
        <button
          type="button"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--primary)] hover:underline"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      ) : null}
    </div>
  );
}
