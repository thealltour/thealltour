"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ConnectedProductBookingSelectionPanel } from "@/components/products/ConnectedProductBookingSelectionPanel";
import { Button } from "@/components/ui/Button";
import type { BookingScrollTarget } from "@/components/products/ProductQuoteContext";
import type { Product } from "@/types/product";

export type ProductBookingSheetProps = {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
  productTitle?: string;
  focusTarget?: BookingScrollTarget;
};

function focusSectionId(target: BookingScrollTarget | undefined): string {
  if (target === "departure") return "product-sheet-departure-section";
  if (target === "options") return "product-sheet-options-section";
  return "product-booking-sheet";
}

export function ProductBookingSheet({
  open,
  onClose,
  product,
  productTitle,
  focusTarget = "panel",
}: ProductBookingSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = focusSectionId(focusTarget);
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, focusTarget]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="product-booking-sheet-title"
      className="fixed inset-0 z-[60] m-0 h-[100dvh] max-h-[100dvh] w-full max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-[var(--overlay)]"
      onClose={onClose}
    >
      <div className="flex h-full flex-col justify-end" onClick={onClose}>
        <div
          className="flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] shadow-[0_-8px_24px_rgba(15,23,42,0.12)]"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 id="product-booking-sheet-title" className="text-base font-semibold text-[var(--text-primary)]">
              출발일·옵션 선택
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              aria-label="닫기"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <ConnectedProductBookingSelectionPanel
              variant="sheet"
              product={product}
              productTitle={productTitle}
            />
          </div>
          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 safe-bottom">
            <Button type="button" variant="accent" size="md" className="w-full" onClick={onClose}>
              확인
            </Button>
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
