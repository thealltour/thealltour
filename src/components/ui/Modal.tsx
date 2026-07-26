"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

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
 * - 컨테이너: Floating glass (.glass-float), 기존 rounded-2xl 유지
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
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
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
        className={cn(
          "glass-float rounded-2xl p-6",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}
