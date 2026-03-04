"use client";

/**
 * 모바일: 박스감 제거(transparent, no rounded/shadow/ring). sm+: 카드 스타일 복원.
 */
export type SurfaceProps = {
  children: React.ReactNode;
  className?: string;
  /** sm+에서 rounded 크기 (기본 3xl) */
  rounded?: "2xl" | "3xl";
};

export function Surface({
  children,
  className = "",
  rounded = "3xl",
}: SurfaceProps) {
  const roundedClass = rounded === "2xl" ? "sm:rounded-2xl" : "sm:rounded-3xl";
  return (
    <div
      className={`rounded-none border-0 bg-transparent shadow-none ring-0 sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] ${roundedClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
