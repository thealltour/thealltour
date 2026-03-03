"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type FilterChipVariant = "default" | "selected" | "premium";

export type FilterChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: FilterChipVariant;
  children: React.ReactNode;
};

/** 기본: surface/border/text-muted. selected: primary-soft/primary. premium: secondary-soft/secondary. 36~40px, pill */
export const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ variant = "default", className, children, ...props }, ref) => {
    const variantClass =
      variant === "selected"
        ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-soft)]"
        : variant === "premium"
          ? "bg-[var(--secondary-soft)] border-[var(--secondary)]/40 text-[var(--secondary)] hover:bg-[var(--secondary-soft)]"
          : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]";

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex min-h-9 items-center rounded-full border px-3.5 py-2 type-caption font-semibold transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none",
          variantClass,
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
FilterChip.displayName = "FilterChip";
