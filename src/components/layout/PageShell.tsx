"use client";

/**
 * 페이지 최상위 wrapper. 모바일에서 좌우 여백 완화(px-3), sm+에서 카드형 레이아웃과 조화.
 */
export type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <div
      className={`px-3 py-6 sm:px-6 sm:py-10 md:px-10 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
