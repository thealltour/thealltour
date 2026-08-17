"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CARD_HOVER,
  CARD_TRANSITION,
  CARD_PADDING_HOME,
  CARD_IMAGE_ASPECT_HOME,
} from "@/lib/cardTokens";
import { cn } from "@/lib/cn";

const FALLBACK_IMAGE = "https://picsum.photos/seed/thealltour-home/800/500";

export type ExploreCategoryCardProps = {
  href: string;
  title: string;
  imageSrc: string;
  /** 카드 설명 한 줄 (선택) */
  subtitle?: string | null;
  /** 상단/코너 배지 등 (선택) */
  badge?: ReactNode;
  /** false면 「자세히 보기」 숨김 — 기본은 홈과 동일하게 표시 */
  showDetailLink?: boolean;
  /** default: 홈 지역·테마 카드와 동일. compact는 동일 토큰 유지(확장용) */
  variant?: "default" | "compact";
  className?: string;
  /** next/image sizes */
  imageSizes: string;
};

/**
 * 홈 지역/테마 탐색 카드 UI 공통화. 카드 전체가 링크.
 */
export function ExploreCategoryCard({
  href,
  title,
  imageSrc,
  subtitle,
  badge,
  showDetailLink = true,
  variant: _variant = "default",
  className,
  imageSizes,
}: ExploreCategoryCardProps) {
  void _variant;
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] sm:rounded-2xl",
        CARD_HOVER,
        CARD_TRANSITION,
        className,
      )}
    >
      <div
        className={cn(
          "relative w-full shrink-0 overflow-hidden bg-[var(--surface-muted)]",
          CARD_IMAGE_ASPECT_HOME,
        )}
      >
        <Image
          src={imageSrc?.trim() || FALLBACK_IMAGE}
          alt=""
          fill
          sizes={imageSizes}
          className="object-cover transition duration-200 group-hover:scale-[1.02]"
        />
        {badge ? (
          <div className="absolute left-2 top-2 z-[1] max-w-[calc(100%-1rem)]">{badge}</div>
        ) : null}
      </div>
      <div className={cn("flex flex-1 flex-col", CARD_PADDING_HOME)}>
        <h3 className="font-card-title text-base font-semibold leading-tight text-[var(--foreground)]">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 line-clamp-1 text-sm text-[var(--text-muted)]">
            {subtitle}
          </p>
        ) : null}
        {showDetailLink ? (
          <span className="mt-2 inline-flex items-center text-sm font-medium text-[var(--primary)] sm:mt-3">
            자세히 보기
            <span className="ml-1" aria-hidden>
              →
            </span>
          </span>
        ) : null}
      </div>
    </Link>
  );
}
