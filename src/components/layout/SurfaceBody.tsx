"use client";

/**
 * Surface 내부 body. 모바일: p-0, sm+: p-6, md+: p-8.
 */
export type SurfaceBodyProps = {
  children: React.ReactNode;
  className?: string;
};

export function SurfaceBody({ children, className = "" }: SurfaceBodyProps) {
  return (
    <div className={`p-0 sm:p-6 md:p-8 ${className}`.trim()}>
      {children}
    </div>
  );
}
