"use client";

import type { ComponentType } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type PlannerChoiceCardProps = {
  selected?: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  onClick?: () => void;
  className?: string;
  icon?: IconComponent;
};

export function PlannerChoiceCard({
  selected = false,
  disabled,
  title,
  description,
  onClick,
  className,
  icon: Icon,
}: PlannerChoiceCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
        "disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-[var(--primary)] bg-[var(--primary-soft)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]",
        className,
      )}
    >
      {Icon ? (
        <Icon
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0",
            selected ? "text-[var(--primary)]" : "text-[var(--text-muted)]",
          )}
          aria-hidden={true}
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block type-body font-semibold text-[var(--foreground)]">{title}</span>
        <span className="mt-0.5 block type-caption text-[var(--text-muted)]">{description}</span>
      </span>
      {selected ? (
        <Check
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]"
          strokeWidth={2.5}
          aria-hidden={true}
        />
      ) : (
        <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      )}
    </button>
  );
}
