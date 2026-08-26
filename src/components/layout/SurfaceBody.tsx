"use client";

/**
 * Surface 내부 body. 모바일: p-0, sm+: --space-lg(24px), md+: --space-xl(32px).
 */
export type SurfaceBodyProps = {
  children: React.ReactNode;
  className?: string;
};

export function SurfaceBody({ children, className = "" }: SurfaceBodyProps) {
  return (
    <div className={`p-0 sm:p-[var(--space-lg)] md:p-[var(--space-xl)] ${className}`.trim()}>
      {children}
    </div>
  );
}
