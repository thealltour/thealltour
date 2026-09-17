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
  /** true: eyebrow를 모든 뷰포트에서 숨김(홈에서 라벨 제거 시 사용). 예전에는 sm~md만 노출이었으나 태블릿에서 잔존해 전 구간 숨김으로 통일 */
  hideEyebrowOnTablet?: boolean;
  /** description `<p>`에 추가 클래스 (가이드 브리지 등 보조 설명 톤 분리) */
  descriptionClassName?: string;
};

/**
 * 홈·랜딩 섹션「더보기」등 텍스트 링크 (모바일·데스크톱 공통).
 * `gap-1.5` + 화살표 span, `text-sm`, 브랜드 블루, hover 시 밑줄·살짝 투명.
 */
export const SECTION_HEADER_MORE_LINK_CLASS =
  "inline-flex items-center gap-1.5 shrink-0 text-sm font-medium text-[var(--primary)] underline-offset-2 transition hover:underline hover:opacity-90";

/** @deprecated `SECTION_HEADER_MORE_LINK_CLASS`와 동일 */
export const SECTION_HEADER_CTA_CLASS = SECTION_HEADER_MORE_LINK_CLASS;

/** @deprecated `SECTION_HEADER_MORE_LINK_CLASS`와 동일 */
export const SECTION_HEADER_MOBILE_CTA_CLASS = SECTION_HEADER_MORE_LINK_CLASS;

/**
 * 홈 메인 콘텐츠 `SectionBlock` 공통: 좌우 px-4(모바일), 헤더↔리스트 리듬은 부모 `space-y-*`로 맞춤.
 */
export const HOME_MAIN_SECTION_BLOCK_CLASS =
  "space-y-4 sm:space-y-5 !px-4 !py-1.5 sm:!px-6 sm:!py-3 md:!px-8 md:!py-4";

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
  hideEyebrowOnTablet = false,
  descriptionClassName,
}: SectionHeaderProps) {
  const eyebrowClass = cn(
    "type-caption tracking-wide text-[var(--text-muted)]",
    hideEyebrowOnTablet ? "hidden" : "hidden sm:block",
  );
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
            <p
              className={cn(
                "type-caption tracking-wide text-[var(--text-muted)]",
                hideEyebrowOnTablet ? "hidden" : "hidden sm:block",
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2
              id={titleId}
              className="heading-display mt-0.5 font-semibold text-lg leading-snug text-[var(--foreground)] sm:mt-0 sm:text-xl sm:leading-tight lg:text-2xl lg:leading-tight"
            >
              {title}
            </h2>
          ) : null}
          {description ? (
            <p
              className={cn(
                "type-small max-w-[640px] text-[var(--text-muted)] sm:mx-auto",
                descriptionClassName,
              )}
            >
              {description}
            </p>
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
        <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0">
          <div className="min-w-0 flex-1 space-y-1">
            {eyebrow ? <p className={eyebrowClass}>{eyebrow}</p> : null}
            {title ? (
              <h2
                id={titleId}
                className="heading-display mt-0.5 font-semibold text-lg leading-snug text-[var(--foreground)] sm:mt-0 sm:text-xl sm:leading-tight lg:text-2xl lg:leading-tight"
              >
                {title}
              </h2>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center sm:hidden">{actionMobile}</div> : null}
        </div>
        {description ? (
          <p
            className={cn(
              "type-small max-w-[640px] text-[var(--text-muted)]",
              descriptionClassName,
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="hidden shrink-0 items-center sm:flex">{actionDesktop}</div>
      ) : null}
    </div>
  );
}
