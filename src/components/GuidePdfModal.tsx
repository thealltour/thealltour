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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-pdf-modal-title"
      onClick={onClose}
    >
      <div
        className="flex h-[calc(100vh-1rem)] w-full max-w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:h-[calc(100vh-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="guide-pdf-modal-title" className="truncate font-semibold text-slate-800">
              {title ?? "여행가이드 PDF"}
            </h2>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block text-xs text-blue-600 underline hover:text-blue-800"
              onClick={(e) => e.stopPropagation()}
            >
              새 탭에서 열기
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
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
