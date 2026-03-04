"use client";

/**
 * 콘텐츠 폭 제한 컨테이너. mx-auto max-w-6xl.
 */
export type ContentContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function ContentContainer({ children, className = "" }: ContentContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-6xl ${className}`.trim()}>
      {children}
    </div>
  );
}
