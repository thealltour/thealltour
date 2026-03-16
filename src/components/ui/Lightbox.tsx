"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ImageIcon } from "lucide-react";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

export type LightboxImage = {
  url: string;
  alt?: string;
};

export type LightboxProps = {
  /** 표시할 이미지 목록 */
  images: LightboxImage[];
  /** 열었을 때 보여줄 인덱스 (0-based) */
  initialIndex?: number;
  /** 닫기 콜백. 닫을 때 포커스 복원은 호출측에서 처리 */
  onClose: () => void;
  /** 닫힐 때 포커스를 돌려줄 요소 (접근성). onClose 후 호출측에서 focus() 호출해도 됨 */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** 이미지 URL 정규화. 미주입 시 normalizeProductImageUrl 사용 */
  normalizeUrl?: (url: string) => string;
  /** 모달 상단에 표시할 제목 (예: 이벤트 제목). 있으면 n/total 왼쪽에 표시 */
  title?: string;
};

function clamp(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
}

export function Lightbox({
  images,
  initialIndex = 0,
  onClose,
  returnFocusRef,
  normalizeUrl = normalizeProductImageUrl,
  title,
}: LightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [currentIndex, setCurrentIndex] = useState(() =>
    clamp(initialIndex, images.length),
  );
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setCurrentIndex(clamp(initialIndex, images.length));
    setImageError(false);
  }, [initialIndex, images.length]);

  useEffect(() => {
    if (images.length === 0) return;
    closeButtonRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        returnFocusRef?.current?.focus();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIndex((i) => clamp(i - 1, images.length));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIndex((i) => clamp(i + 1, images.length));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      returnFocusRef?.current?.focus();
    };
  }, [images.length, onClose, returnFocusRef]);

  if (images.length === 0) return null;

  const current = images[clamp(currentIndex, images.length)];
  const src = current ? normalizeUrl(current.url) : "";
  const total = images.length;
  const oneBased = currentIndex + 1;

  const handleImageError = () => setImageError(true);

  useEffect(() => {
    setImageError(false);
  }, [currentIndex]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--overlay)] p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="이미지 확대 보기"
      onClick={onClose}
    >
      <div
        className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {title && (
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]" title={title}>
                {title}
              </p>
            )}
            <p className="shrink-0 text-sm font-medium text-[var(--text-muted)]" aria-live="polite">
              {oneBased} / {total}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => {
              onClose();
              returnFocusRef?.current?.focus();
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center gap-2 p-2">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => clamp(i - 1, total))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-40 disabled:pointer-events-none"
            aria-label="이전 이미지"
            disabled={total <= 1}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-lg bg-[var(--surface-muted)]">
            {src && current && !imageError ? (
              <Image
                src={src}
                alt={current.alt ?? `이미지 ${oneBased}`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 80vw"
                unoptimized
                onError={handleImageError}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)]" aria-hidden>
                <ImageIcon className="h-16 w-16 opacity-50" />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCurrentIndex((i) => clamp(i + 1, total))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-40 disabled:pointer-events-none"
            aria-label="다음 이미지"
            disabled={total <= 1}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}