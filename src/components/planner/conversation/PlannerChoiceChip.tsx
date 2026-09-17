"use client";

import type { ComponentType, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type PlannerChoiceChipProps = {
  selected?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
  icon?: IconComponent;
};

/** Conversation single/multi choice — wraps button semantics without changing shared FilterChip. */
export function PlannerChoiceChip({
  selected = false,
  disabled,
  children,
  onClick,
  className,
  "aria-label": ariaLabel,
  icon: Icon,
}: PlannerChoiceChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-2 type-caption font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]",
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden={true} /> : null}
      <span className="min-w-0">{children}</span>
      {selected ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden={true} /> : null}
    </button>
  );
}
