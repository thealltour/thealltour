"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { trackHomeQuickActionClick } from "@/lib/analytics/trackHomeEvents";
import {
  HOME_HERO_QUICK_ACTION_ICONS,
  type HomeHeroQuickAction,
} from "@/lib/homeHeroQuickActions";

const ICON_SIZE = 22;
const ICON_STROKE = 1.75;

export type HomeQuickActionProps = {
  action: HomeHeroQuickAction;
  /** 1-based index for analytics */
  position: number;
  className?: string;
};

/**
 * 홈 히어로 모바일 Quick Action — icon top / label bottom, equal-weight entry.
 */
export function HomeQuickAction({ action, position, className }: HomeQuickActionProps) {
  const Icon = HOME_HERO_QUICK_ACTION_ICONS[action.id];

  return (
    <Link
      href={action.href}
      className={cn(
        "group flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1 text-center",
        "transition-colors duration-150 hover:bg-[var(--surface-muted)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        className,
      )}
      aria-label={action.ariaLabel ?? action.label}
      onClick={() =>
        trackHomeQuickActionClick({
          label: action.label,
          href: action.href,
          position,
        })
      }
    >
      <Icon
        className="shrink-0 text-[var(--hero-text-secondary)] transition-colors duration-150 group-hover:text-[var(--hero-text-primary)] group-focus-visible:text-[var(--primary)]"
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE}
        aria-hidden
      />
      <span className="line-clamp-2 w-full text-[11px] font-medium leading-tight tracking-tight text-[var(--hero-text-secondary)] transition-colors duration-150 group-hover:text-[var(--hero-text-primary)] group-focus-visible:text-[var(--hero-text-primary)]">
        {action.label}
      </span>
    </Link>
  );
}
