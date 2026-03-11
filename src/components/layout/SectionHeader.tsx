"use client";

import { cn } from "@/lib/cn";

export type SectionHeaderProps = {
  /** 상단 라벨 (선택) */
  eyebrow?: React.ReactNode;
  /** 섹션 제목 */
  title?: React.ReactNode;
  /** 부가 설명 (선택) */
  description?: React.ReactNode;
  /** 오른쪽 CTA 링크 등 (선택). 모바일에서는 헤더 아래로 배치 */
  action?: React.ReactNode;
  /** 정렬. left 시 왼쪽 블록 + 오른쪽 action, center 시 모두 가운데 */
  align?: "left" | "center";
  className?: string;
  /** h2에 부여할 id (섹션 aria-labelledby 연결용) */
  titleId?: string;
};

/** 섹션 CTA용 텍스트 링크 스타일 (전체보기 등) */
export const SECTION_HEADER_CTA_CLASS =
  "inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline";

/**
 * 섹션 헤더. 홈·랜딩 등 섹션 공통.
 * 레이아웃: 왼쪽(eyebrow + title + description) / 오른쪽(action). 모바일에서는 action이 아래로 배치.
 * 타이포: eyebrow(caption), title(display semibold 반응형), description(small muted).
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className,
  titleId,
}: SectionHeaderProps) {
  const hasTop = Boolean(eyebrow ?? title ?? description);
  const isCenter = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4",
        isCenter && "sm:flex-col sm:items-center sm:text-center",
        className
      )}
    >
      <div className={cn("space-y-1", isCenter && "flex flex-col sm:items-center")}>
        {eyebrow ? (
          <p className="type-caption tracking-wide text-[var(--text-muted)]">{eyebrow}</p>
        ) : null}
        {title ? (
          <h2
            id={titleId}
            className="heading-display font-semibold text-lg text-[var(--foreground)] sm:text-xl lg:text-2xl"
          >
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className={cn("type-small max-w-[640px] text-[var(--text-muted)]", isCenter && "sm:mx-auto")}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className={cn("shrink-0", hasTop && isCenter && "sm:pt-1")}>{action}</div>
      ) : null}
    </div>
  );
}
