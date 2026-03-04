"use client";

/**
 * 모바일: 1열 스택(space-y-3), sm 이상: grid.
 * 모바일에서 grid-cols-2 등으로 셀감 나는 것 방지용.
 */
export type ResponsiveGridProps = {
  children: React.ReactNode;
  /** sm+ grid 열 수 (기본 2) */
  cols?: 2 | 3 | 4;
  /** sm+ gap (기본 3) */
  gap?: 3 | 4;
  className?: string;
};

const gridColsClass = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

const gapClass = {
  3: "sm:gap-3",
  4: "sm:gap-4",
};

export function ResponsiveGrid({
  children,
  cols = 2,
  gap = 3,
  className = "",
}: ResponsiveGridProps) {
  return (
    <div
      className={`flex flex-col space-y-3 sm:space-y-0 sm:grid ${gridColsClass[cols]} ${gapClass[gap]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
