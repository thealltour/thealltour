"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import type { CoverCandidate } from "@/lib/products/recommendCoverImage";

export type CoverRecommendModalProps = {
  open: boolean;
  candidates: CoverCandidate[];
  onClose: () => void;
  onSelect: (url: string) => void;
};

export function CoverRecommendModal({
  open,
  candidates,
  onClose,
  onSelect,
}: CoverRecommendModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    panelRef.current?.scrollTo({ top: 0 });
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape, candidates]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cover-recommend-modal-title"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cover-recommend-modal-title" className="mb-3 text-lg font-bold text-[var(--text-primary)]">
          대표 이미지 추천
        </h3>
        {candidates.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            추천할 이미지가 없습니다. 상품 이미지 또는 일정 이미지를 먼저 등록하세요.
          </p>
        ) : (
          <ul className="space-y-3">
            {candidates.map((c, i) => (
              <li
                key={c.url + i}
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3"
              >
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded bg-[var(--surface)]">
                  <img
                    src={normalizeProductImageUrl(c.url)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--text-muted)]">{c.reason}</p>
                  <button
                    type="button"
                    onClick={() => onSelect(c.url)}
                    className="mt-1 rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                  >
                    대표로 지정
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          닫기
        </button>
      </div>
    </div>,
    document.body,
  );
}
