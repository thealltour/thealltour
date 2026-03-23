"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type BreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
  /** desktop: 전체 트레일 / compact: 상위 구간 축약(… + 하위 2단) */
  variant?: "full" | "compact";
};

function Separator() {
  return (
    <span className="shrink-0 text-[var(--text-muted)]/60" aria-hidden>
      ›
    </span>
  );
}

type CrumbEntry = BreadcrumbItem | { kind: "ellipsis" };

function isEllipsisEntry(e: CrumbEntry): e is { kind: "ellipsis" } {
  return "kind" in e && e.kind === "ellipsis";
}

function buildDisplayEntries(items: BreadcrumbItem[], variant: "full" | "compact"): CrumbEntry[] {
  if (variant === "compact" && items.length > 2) {
    return [{ kind: "ellipsis" }, items[items.length - 2]!, items[items.length - 1]!];
  }
  return items;
}

/**
 * 브레드크럼 — 정책/레이아웃은 상위(NavigationContextHeader 등)에서 제어.
 */
export function Breadcrumb({ items, className, variant = "full" }: BreadcrumbProps) {
  if (items.length === 0) return null;

  const display = buildDisplayEntries(items, variant);

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0 text-sm text-[var(--text-muted)]", className)}>
      <ol className="flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1">
        {display.map((entry, i) => {
          if (isEllipsisEntry(entry)) {
            return (
              <li key={`ellipsis-${i}`} className="flex min-w-0 max-w-full items-center gap-1.5">
                {i > 0 ? <Separator /> : null}
                <span className="shrink-0 text-[var(--text-muted)]/50 select-none" aria-hidden>
                  …
                </span>
              </li>
            );
          }
          const item: BreadcrumbItem = entry;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 max-w-full items-center gap-1.5">
              {i > 0 ? <Separator /> : null}
              {item.href ? (
                <Link
                  href={item.href}
                  className="min-w-0 truncate text-[var(--primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-sm"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="min-w-0 truncate font-medium text-[var(--foreground)]">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
