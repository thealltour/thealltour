import * as React from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
};

/** bg=--surface, border=--border, radius 12px. focus: border --primary, ring 3px --focus-ring. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "w-full min-h-[88px] rounded-xl border bg-[var(--surface)] px-4 py-3.5 type-body outline-none transition",
          "text-[var(--foreground)] placeholder:text-[var(--text-subtle)]",
          "border-[var(--border)] hover:border-[var(--border-strong)]",
          "focus-visible:border-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
          "disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-subtle)] disabled:cursor-not-allowed disabled:opacity-90",
          error &&
            "border-[var(--danger)] focus-visible:border-[var(--danger)] focus-visible:ring-[var(--danger)]",
          className,
        )}
        aria-invalid={error}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
