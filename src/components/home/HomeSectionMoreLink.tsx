"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackHomeSectionMoreClick } from "@/lib/analytics/trackHomeEvents";

export type HomeSectionMoreLinkProps = {
  href: string;
  /** analytics section key — e.g. golf, destination, theme */
  section: string;
  /** analytics label (defaults to ariaLabel) */
  label?: string;
  ariaLabel: string;
  className: string;
  children: ReactNode;
};

/** 홈 섹션 헤더 "더보기" 링크 — 클릭 계측 포함 */
export function HomeSectionMoreLink({
  href,
  section,
  label,
  ariaLabel,
  className,
  children,
}: HomeSectionMoreLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={() =>
        trackHomeSectionMoreClick({
          section,
          label: label ?? ariaLabel,
          href,
        })
      }
    >
      {children}
    </Link>
  );
}
