"use client";

import * as React from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { ko } from "date-fns/locale";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatIsoDateKorean } from "@/lib/inquiry/desiredDeparture";
import { buildDisabledMatcher, dateToYmd, ymdToDate } from "@/lib/datePickerUtils";
import "react-day-picker/style.css";
import "./datePicker.css";

export type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
  size?: "default" | "compact";
};

function formatRangeLabel(from: string, to: string, placeholder: string): string {
  if (!from && !to) return placeholder;
  const fromLabel = from ? (formatIsoDateKorean(from) ?? from) : "시작일";
  const toLabel = to ? (formatIsoDateKorean(to) ?? to) : "종료일";
  return `${fromLabel} ~ ${toLabel}`;
}

export function DateRangePicker({
  from,
  to,
  onChange,
  min,
  max,
  disabled,
  placeholder = "기간 선택",
  className,
  triggerClassName,
  "aria-label": ariaLabel,
  size = "default",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected: DateRange | undefined = React.useMemo(() => {
    const fromDate = ymdToDate(from);
    const toDate = ymdToDate(to);
    if (!fromDate && !toDate) return undefined;
    return { from: fromDate, to: toDate };
  }, [from, to]);

  const disabledMatcher = React.useMemo(() => buildDisabledMatcher(min, max), [min, max]);

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

  function handleSelect(range: DateRange | undefined) {
    if (!range) return;
    const nextFrom = range.from ? dateToYmd(range.from) : "";
    const nextTo = range.to ? dateToYmd(range.to) : "";
    onChange(nextFrom, nextTo);
    if (range.from && range.to) setOpen(false);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? "기간 선택"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border bg-[var(--surface)] px-4 text-left outline-none transition",
          "border-[var(--border)] hover:border-[var(--border-strong)]",
          "focus-visible:border-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
          "disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-subtle)] disabled:opacity-90",
          size === "default" ? "h-11 type-body" : "h-9 text-xs",
          !from && !to && "text-[var(--text-subtle)]",
          (from || to) && "text-[var(--foreground)]",
          triggerClassName,
        )}
      >
        <span className="truncate">{formatRangeLabel(from, to, placeholder)}</span>
        <Calendar className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={ariaLabel ?? "기간 달력"}
          className="absolute left-0 top-full z-50 mt-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 shadow-[var(--shadow-modal)]"
        >
          <DayPicker
            mode="range"
            locale={ko}
            numberOfMonths={2}
            selected={selected}
            onSelect={handleSelect}
            disabled={disabledMatcher}
            className="theall-day-picker"
            showOutsideDays
          />
        </div>
      ) : null}
    </div>
  );
}
