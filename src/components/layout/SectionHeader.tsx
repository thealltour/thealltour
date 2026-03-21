"use client";

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

function duplicateActionForLayout(action: ReactNode): { mobile: ReactNode; desktop: ReactNode } {
  if (action == null) {
    return { mobile: null, desktop: null };
  }
  if (isValidElement(action)) {
    return {
      mobile: cloneElement(action as ReactElement, { key: "section-header-action-mobile" }),
      desktop: cloneElement(action as ReactElement, { key: "section-header-action-desktop" }),
    };
  }
  return { mobile: action, desktop: action };
}

export type SectionHeaderProps = {
  /** 상단 라벨 (선택) */
  eyebrow?: React.ReactNode;
  /** 섹션 제목 */
  title?: React.ReactNode;
  /** 부가 설명 (선택) */
  description?: React.ReactNode;
  /** 오른쪽 CTA 링크 등 (선택). align=left: 모바일은 제목과 한 줄, sm+ 는 본문 우측 끝 */
  action?: React.ReactNode;
  /** 정렬. left 시 왼쪽 블록 + 오른쪽 action, center 시 모두 가운데 */
  align?: "left" | "center";
  className?: string;
  /** h2에 부여할 id (섹션 aria-labelledby 연결용) */
  titleId?: string;
};

/** 섹션 CTA용 텍스트 링크 스타일 (전체보기 등, 데스크톱 위주) */
export const SECTION_HEADER_CTA_CLASS =
  "inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline";

/** 홈 섹션 헤더「더보기」등 모바일·데스크톱 공통 CTA (text-xs → sm:text-sm) */
export const SECTION_HEADER_MOBILE_CTA_CLASS =
  "inline-flex items-center gap-1 shrink-0 text-xs font-medium text-[var(--primary)] hover:underline sm:text-sm";

/**
 * 섹션 헤더. 홈·랜딩 등 섹션 공통.
 * align=left: 모바일에서 제목+action 한 줄, description 은 그 아래. sm+ 에서 본문(eyebrow+title+description) 좌측 / action 우측.
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
  const { mobile: actionMobile, desktop: actionDesktop } = duplicateActionForLayout(action);

  if (isCenter) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-3 text-center sm:gap-4",
          hasTop && action != null && action !== false ? "sm:pt-0" : undefined,
          className
        )}
      >
        <div className="flex flex-col items-center space-y-1">
          {eyebrow ? (
            <p className="hidden sm:block type-caption tracking-wide text-[var(--text-muted)]">{eyebrow}</p>
          ) : null}
          {title ? (
            <h2
              id={titleId}
              className="heading-display mt-0.5 font-semibold text-lg text-[var(--foreground)] sm:mt-0 sm:text-xl lg:text-2xl"
            >
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="type-small max-w-[640px] text-[var(--text-muted)] sm:mx-auto">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0 sm:pt-1">{action}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-2 sm:flex sm:items-end sm:justify-between sm:gap-4 sm:space-y-0",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-2 sm:space-y-1">
        <div className="flex items-start justify-between gap-3 sm:block">
          <div className="min-w-0 flex-1 space-y-1">
            {eyebrow ? (
              <p className="hidden sm:block type-caption tracking-wide text-[var(--text-muted)]">{eyebrow}</p>
            ) : null}
            {title ? (
              <h2
                id={titleId}
                className="heading-display mt-0.5 font-semibold text-lg text-[var(--foreground)] sm:mt-0 sm:text-xl lg:text-2xl"
              >
                {title}
              </h2>
            ) : null}
          </div>
          {action ? <div className="shrink-0 sm:hidden">{actionMobile}</div> : null}
        </div>
        {description ? (
          <p className="type-small max-w-[640px] text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="hidden shrink-0 sm:block">{actionDesktop}</div> : null}
    </div>
  );
}
