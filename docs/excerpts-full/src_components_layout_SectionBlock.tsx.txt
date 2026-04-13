"use client";

import { cn } from "@/lib/cn";

export type SectionBlockSurface = "none" | "muted" | "card";
export type SectionBlockPadding = "none" | "sm" | "md" | "lg";

export type SectionBlockProps = {
  children: React.ReactNode;
  id?: string;
  className?: string;
  /** 헤더 영역(예: SectionHeader)을 감쌀 때 적용할 클래스 */
  headerClassName?: string;
  /** 배경/박스 스타일. none: 투명, muted: surface-muted, card: surface+ring */
  surface?: SectionBlockSurface;
  /** 내부 패딩 */
  padding?: SectionBlockPadding;
  /** 헤더 영역(선택). 있으면 headerClassName으로 감싸서 상단에 렌더 */
  header?: React.ReactNode;
};

const SURFACE_CLASS: Record<SectionBlockSurface, string> = {
  none: "bg-transparent",
  muted: "bg-[var(--surface-muted)] ring-1 ring-[var(--border)]",
  card: "bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow-soft)]",
};

const PADDING_CLASS: Record<SectionBlockPadding, string> = {
  none: "p-0",
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-6 md:p-8",
  lg: "p-6 sm:p-8 md:p-10",
};

/**
 * 섹션 블록. spacing·surface·padding 통일.
 * 홈/목록/상세 공통 사용 가능.
 */
export function SectionBlock({
  children,
  id,
  className,
  headerClassName,
  surface = "none",
  padding = "md",
  header,
}: SectionBlockProps) {
  return (
    <section
      id={id}
      className={cn(
        "space-y-6",
        SURFACE_CLASS[surface],
        padding === "none" ? "" : "rounded-2xl sm:rounded-3xl",
        PADDING_CLASS[padding],
        className
      )}
    >
      {header ? (
        <div className={cn(headerClassName)}>{header}</div>
      ) : null}
      {children}
    </section>
  );
}
