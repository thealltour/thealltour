"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

type TravelerCounterProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
};

export function TravelerCounter({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: TravelerCounterProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <span className="type-body font-medium text-[var(--foreground)]">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-strong)]",
            "bg-[var(--surface)] text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]",
            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
            "disabled:opacity-40 disabled:pointer-events-none",
          )}
          aria-label={`${label} 줄이기`}
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="min-w-8 text-center type-body font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-strong)]",
            "bg-[var(--surface)] text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]",
            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
            "disabled:opacity-40 disabled:pointer-events-none",
          )}
          aria-label={`${label} 늘리기`}
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
