"use client";

/**
 * 예외용: 칩/배지/아이콘/짧은 항목 목록 등 모바일에서도 grid 유지.
 * 필터·태그·썸네일 그리드 등에 사용.
 */
export type InlineGridProps = {
  children: React.ReactNode;
  /** 모바일 열 수 (기본 2) */
  cols?: 2 | 3;
  /** sm+ 열 수 (기본 3 또는 4) */
  smCols?: 3 | 4;
  gap?: 2 | 3;
  className?: string;
};

export function InlineGrid({
  children,
  cols = 2,
  smCols = 3,
  gap = 2,
  className = "",
}: InlineGridProps) {
  const colsClass = cols === 2 ? "grid-cols-2" : "grid-cols-3";
  const smColsClass = smCols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";
  const gapClass = gap === 2 ? "gap-2" : "gap-3";
  return (
    <div
      className={`grid ${colsClass} ${gapClass} ${smColsClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
