"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  getOverlayFocusableElements,
  restoreFocus,
  trapOverlayTabKey,
} from "@/lib/a11y/overlayFocus";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 백드롭 클릭 시 닫기 (기본 true) */
  closeOnBackdropClick?: boolean;
  /** 모달 외곽 래퍼 클래스 (정렬/패딩 조정) */
  wrapperClassName?: string;
  /** 컨테이너 추가 클래스 (크기·패딩 등) */
  className?: string;
  /** role="dialog" 등 접근성용 */
  "aria-label"?: string;
};

/**
 * 테마 토큰 기반 공통 모달 레이아웃.
 * - 백드롭: var(--overlay)
 * - Escape / backdrop / dialog semantics
 * - body scroll lock, focus trap, focus return (PR-UI-10A)
 */
export function Modal({
  isOpen,
  onClose,
  children,
  closeOnBackdropClick = true,
  wrapperClassName = "",
  className = "",
  "aria-label": ariaLabel,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      const root = dialogRef.current;
      if (!root) return;
      const autofocus = root.querySelector<HTMLElement>("[autofocus]");
      if (autofocus) {
        autofocus.focus();
        return;
      }
      const focusables = getOverlayFocusableElements(root);
      if (focusables.length > 0) {
        focusables[0].focus();
        return;
      }
      root.focus();
    });

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const root = dialogRef.current;
      if (root) trapOverlayTabKey(e, root);
    }

    window.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      restoreFocus(previousFocusedElementRef.current);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-[2px]",
        wrapperClassName,
      )}
      onClick={closeOnBackdropClick ? onClose : undefined}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={cn("glass-float rounded-2xl p-6", className)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
