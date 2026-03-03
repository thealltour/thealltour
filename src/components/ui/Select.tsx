import * as React from "react";
import { cn } from "@/lib/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean;
};

/** bg=--surface, border=--border, 44px height, radius 12px. focus: border --primary, ring 3px --focus-ring. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border bg-[var(--surface)] px-4 type-small outline-none transition",
          "text-[var(--foreground)]",
          "border-[var(--border)] hover:border-[var(--border-strong)]",
          "focus-visible:border-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
          "disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-subtle)] disabled:cursor-not-allowed disabled:opacity-90",
          error &&
            "border-[var(--danger)] focus-visible:border-[var(--danger)] focus-visible:ring-[var(--danger)]",
          className,
        )}
        aria-invalid={error}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";
