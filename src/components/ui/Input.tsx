import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

/** bg=--surface, border=--border, 44px height, radius 12px. focus: border --primary, ring 3px --focus-ring. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-11 w-full rounded-xl border bg-[var(--surface)] px-4 type-body outline-none transition",
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

Input.displayName = "Input";
