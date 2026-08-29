"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ProductSortId } from "@/lib/productFilters";
import { SORT_OPTIONS } from "@/lib/productFilters";
import { cn } from "@/lib/cn";
import { getOverlayFocusableElements, restoreFocus, trapOverlayTabKey } from "@/lib/a11y/overlayFocus";

export type MobileProductSortSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  currentSort: ProductSortId;
  onSelect: (sort: ProductSortId) => void;
  /** 미지정 시 Browse SORT_OPTIONS + 기본순 */
  options?: { value: ProductSortId; label: string }[];
};

export function MobileProductSortSheet({
  isOpen,
  onClose,
  currentSort,
  onSelect,
  options,
}: MobileProductSortSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      const root = dialogRef.current;
      if (!root) return;
      const selected = root.querySelector<HTMLElement>('[aria-current="true"]');
      if (selected) {
        selected.focus();
        return;
      }
      const focusables = getOverlayFocusableElements(root);
      const firstSort = focusables.find((el) => el.getAttribute("data-sort-option") === "true");
      (firstSort ?? focusables[0])?.focus();
    });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const root = dialogRef.current;
      if (root) trapOverlayTabKey(e, root);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
      restoreFocus(previousActiveElementRef.current);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sortRows = options ?? [{ value: "" as ProductSortId, label: "기본순" }, ...SORT_OPTIONS];

  const content = (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="정렬"
      tabIndex={-1}
    >
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-[var(--overlay)]"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 rounded-t-2xl glass-float border-b-0 safe-bottom",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--divider)] px-4 py-3">
          <h2 className="type-small font-semibold text-[var(--foreground)]">정렬</h2>
        </div>
        <ul className="py-2">
          {sortRows.map((opt) => {
            const selected = currentSort === opt.value;
            return (
              <li key={opt.value === "" ? "sort-default" : opt.value}>
                <button
                  type="button"
                  data-sort-option="true"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-3 text-left type-small transition-colors",
                    selected
                      ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
                      : "text-[var(--text-primary)] active:bg-[var(--surface-muted)]",
                  )}
                >
                  {opt.label}
                  {selected ? (
                    <span className="text-[var(--primary)]" aria-hidden>✓</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
