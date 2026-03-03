"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { PdfViewer } from "@/components/PdfViewer";

type GuidePdfModalProps = {
  isOpen: boolean;
  pdfUrl: string;
  title?: string;
  onClose: () => void;
};

export function GuidePdfModal({ isOpen, pdfUrl, title, onClose }: GuidePdfModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-pdf-modal-title"
      onClick={onClose}
    >
      <div
        className="flex h-[calc(100vh-1rem)] w-full max-w-full flex-col overflow-hidden rounded-xl bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)] ring-1 ring-[var(--border)] sm:h-[calc(100vh-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--divider)] bg-[var(--surface-elevated)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="guide-pdf-modal-title" className="truncate font-semibold text-[var(--text-primary)]">
              {title ?? "여행가이드 PDF"}
            </h2>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block text-xs text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
              onClick={(e) => e.stopPropagation()}
            >
              새 탭에서 열기
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            aria-label="모달 닫기"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <PdfViewer url={pdfUrl} className="h-full" />
        </div>
      </div>
    </div>
  );
}
