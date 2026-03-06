"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ProductSortId } from "@/lib/productFilters";
import { SORT_OPTIONS } from "@/lib/productFilters";
import { cn } from "@/lib/cn";

export type MobileProductSortSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  currentSort: ProductSortId;
  onSelect: (sort: ProductSortId) => void;
};

export function MobileProductSortSheet({
  isOpen,
  onClose,
  currentSort,
  onSelect,
}: MobileProductSortSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="정렬"
    >
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-[var(--overlay)]"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 rounded-t-2xl border border-b-0 border-[var(--border)]",
          "bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)] safe-bottom",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--divider)] px-4 py-3">
          <h2 className="type-small font-semibold text-[var(--foreground)]">정렬</h2>
        </div>
        <ul className="py-2">
          {SORT_OPTIONS.filter((o) => o.value).map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => {
                  onSelect(opt.value as ProductSortId);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-3 text-left type-small transition-colors",
                  currentSort === opt.value
                    ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
                    : "text-[var(--text-primary)] active:bg-[var(--surface-muted)]",
                )}
              >
                {opt.label}
                {currentSort === opt.value ? (
                  <span className="text-[var(--primary)]" aria-hidden>✓</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
