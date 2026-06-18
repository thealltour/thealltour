"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatIsoDateKorean } from "@/lib/inquiry/desiredDeparture";
import { buildDisabledMatcher, dateToYmd, ymdToDate } from "@/lib/datePickerUtils";
import { TheallDayPicker } from "@/components/ui/TheallDayPicker";
import "react-day-picker/style.css";
import "./datePicker.css";

export type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  name?: string;
  "aria-label"?: string;
  size?: "default" | "compact";
};

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = "날짜 선택",
  className,
  triggerClassName,
  name,
  "aria-label": ariaLabel,
  size = "default",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = ymdToDate(value);
  const disabledMatcher = buildDisabledMatcher(min, max);
  const displayLabel = value ? (formatIsoDateKorean(value) ?? value) : placeholder;

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  React.useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open]);

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    onChange(dateToYmd(date));
    setOpen(false);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? "날짜 선택"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border bg-[var(--surface)] px-4 text-left outline-none transition",
          "border-[var(--border)] hover:border-[var(--border-strong)]",
          "focus-visible:border-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
          "disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-subtle)] disabled:opacity-90",
          size === "default" ? "h-11 type-body" : "h-9 text-xs",
          !value && "text-[var(--text-subtle)]",
          value && "text-[var(--foreground)]",
          triggerClassName,
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <Calendar className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={ariaLabel ?? "달력"}
          className="absolute left-0 top-full z-50 mt-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 shadow-[var(--shadow-modal)]"
        >
          <TheallDayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={disabledMatcher}
          />
        </div>
      ) : null}
    </div>
  );
}
