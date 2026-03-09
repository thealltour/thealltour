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
};

/**
 * 브레드크럼 네비게이션. Hero 아래 콘텐츠 페이지에 사용.
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm text-[var(--text-muted)] mb-6", className)}>
      <ol className="flex flex-wrap gap-x-2 gap-y-1 items-center">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            {i > 0 ? (
              <span className="text-[var(--text-muted)]/70" aria-hidden>
                &gt;
              </span>
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="text-[var(--primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-[var(--foreground)] font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
