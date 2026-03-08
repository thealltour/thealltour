"use client";

import { cn } from "@/lib/cn";

export type SectionHeaderProps = {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
};

/**
 * 섹션 헤더. 여행 플랫폼형 섹션에서 공통 사용.
 * 스타일 추상화만 담당.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className,
}: SectionHeaderProps) {
  const hasTop = Boolean(eyebrow ?? title ?? description);
  const alignClass = align === "center" ? "text-center" : "text-left";

  return (
    <div className={cn("space-y-2", alignClass, className)}>
      {hasTop ? (
        <div className="space-y-2">
          {eyebrow ? (
            <p className="section-label text-[var(--text-muted)]">{eyebrow}</p>
          ) : null}
          {title ? (
            <h2 className="heading-display section-title type-h2 text-[var(--foreground)]">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="type-small text-[var(--text-muted)]">{description}</p>
          ) : null}
        </div>
      ) : null}
      {action ? <div className={cn(hasTop && "pt-1")}>{action}</div> : null}
    </div>
  );
}
