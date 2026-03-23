"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useBackNavigation } from "@/components/navigation/useBackNavigation";
import { getFallbackPath } from "@/lib/navigation/getFallbackPath";

export type MobileBackHeaderProps = {
  /** 한 줄 타이틀 (예: 「일본 여행」) */
  title: string;
  /** 기본은 pathname 기반 `getFallbackPath` */
  fallbackHref?: string;
  /** 꼭 필요할 때만 — 낮은 대비 보조 한 줄 */
  hint?: string;
  className?: string;
};

/**
 * 모바일 전용 — 뒤로 아이콘+타이틀을 하나의 클릭 영역으로 묶음. SiteHeader 아래 sticky.
 */
export function MobileBackHeader({ title, fallbackHref, hint, className }: MobileBackHeaderProps) {
  const pathname = usePathname();
  const fallback = fallbackHref ?? getFallbackPath(pathname);
  const goBack = useBackNavigation(fallback);

  return (
    <header
      className={cn(
        "md:hidden sticky z-40 w-full border-b border-[var(--border)]/40",
        "bg-white/70 backdrop-blur-md dark:bg-[var(--surface)]/75",
        "top-[var(--products-mobile-stack-top)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={goBack}
        className={cn(
          "flex h-11 min-h-[44px] w-full min-w-[44px] max-w-full items-center gap-2 rounded-lg px-1.5 text-left",
          "text-[var(--text-primary)] transition-colors active:bg-[var(--surface-muted)]/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
        )}
        aria-label={`뒤로 가기, ${title}`}
      >
        <ChevronLeft className="size-5 shrink-0 text-[var(--foreground)]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--foreground)]">
          {title}
        </span>
      </button>
      {hint ? (
        <p className="type-small -mt-1 px-3 pb-2 text-[var(--text-muted)] opacity-70">{hint}</p>
      ) : null}
    </header>
  );
}
