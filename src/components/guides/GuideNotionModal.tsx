"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";

type GuideNotionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Notion 공유 페이지 URL (iframe src) */
  notionUrl: string;
  title?: string;
};

export function GuideNotionModal({ isOpen, onClose, notionUrl, title }: GuideNotionModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    previousActiveElement.current?.focus?.();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previousActiveElement.current =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement) : null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => closeButtonRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleFocus(e: FocusEvent) {
      const target = e.target as Node;
      const overlay = overlayRef.current;
      if (!overlay || !target || overlay.contains(target)) return;
      e.preventDefault();
      closeButtonRef.current?.focus();
    }
    document.addEventListener("focusin", handleFocus);
    return () => document.removeEventListener("focusin", handleFocus);
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const safeNotionUrl = notionUrl?.trim() || "";
  const hasUrl = safeNotionUrl.length > 0;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex flex-col bg-[#0f172a]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title || "노션 원문 보기"}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">
          {title || "원문 보기"}
        </span>
        {hasUrl ? (
          <a
            href={safeNotionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            새 탭에서 열기
          </a>
        ) : null}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/90 transition hover:bg-white/10 hover:text-white"
          aria-label="닫기"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {hasUrl ? (
          <>
            <div
              className="absolute inset-0 flex items-center justify-center bg-[#0b1220]"
              aria-hidden="true"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
            </div>
            <iframe
              src={safeNotionUrl}
              title={title || "노션 원문"}
              className="relative z-10 h-full w-full flex-1 border-0 bg-white"
              style={{
                minHeight:
                  "calc(100dvh - 3.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
              }}
              loading="eager"
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-white/60">
            <p>원문 URL이 없습니다.</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
