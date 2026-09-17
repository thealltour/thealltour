"use client";

import type { ComponentType, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getPlannerIconToneClasses,
  type PlannerVisualTone,
} from "@/components/planner/conversation/plannerConversationIcons";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type PlannerChoiceChipProps = {
  selected?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
  icon?: IconComponent;
  /** Category meaning tone (unselected only). Selected uses primary. */
  iconTone?: PlannerVisualTone;
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
  iconTone,
}: PlannerChoiceChipProps) {
  const toneClasses = iconTone ? getPlannerIconToneClasses(iconTone) : null;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 type-caption font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]",
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            selected
              ? "bg-[var(--primary-soft)] text-[var(--primary)]"
              : toneClasses
                ? cn(toneClasses.container, toneClasses.icon)
                : "bg-[var(--surface-muted)] text-[var(--text-muted)]",
          )}
          aria-hidden={true}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden={true} />
        </span>
      ) : null}
      <span className="min-w-0">{children}</span>
      {selected ? (
        <Check
          className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]"
          strokeWidth={2.5}
          aria-hidden={true}
        />
      ) : null}
    </button>
  );
}
