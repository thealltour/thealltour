"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

export type SortOption<T = string> = {
  value: T;
  label: string;
};

export type SortDropdownProps<T = string> = {
  options: SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  triggerClassName?: string;
};

/** 트리거: outline/ghost. 드롭다운: surface-elevated, shadow-modal, divider, option hover surface-muted, selected primary-soft + text primary */
export function SortDropdown<T extends string>({
  options,
  value,
  onChange,
  className,
  triggerClassName,
}: SortDropdownProps<T>) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((p) => !p)}
        className={cn("min-h-9 gap-1", triggerClassName)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {current?.label ?? "정렬"}
        <ChevronDown
          className={cn("h-4 w-4 transition", open && "rotate-180")}
          aria-hidden
        />
      </Button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)]"
          role="listbox"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between border-b border-[var(--divider)] px-4 py-2.5 text-left text-sm last:border-b-0",
                "transition hover:bg-[var(--surface-muted)]",
                opt.value === value &&
                  "bg-[var(--primary-soft)] font-medium text-[var(--primary)]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
