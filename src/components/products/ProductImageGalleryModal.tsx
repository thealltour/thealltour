"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";

export type ProductGalleryImage = {
  url: string;
  alt: string;
  label?: string;
};

type ProductImageGalleryModalProps = {
  isOpen: boolean;
  images: ProductGalleryImage[];
  selectedIndex: number;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
};

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
}

export function ProductImageGalleryModal({
  isOpen,
  images,
  selectedIndex,
  onClose,
  onSelectIndex,
}: ProductImageGalleryModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const current = images[clampIndex(selectedIndex, images.length)];

  const focusableSelector = useMemo(
    () =>
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    [],
  );

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSelectIndex(clampIndex(selectedIndex - 1, images.length));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onSelectIndex(clampIndex(selectedIndex + 1, images.length));
        return;
      }

      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((el) => !el.hasAttribute("disabled"));

      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusableSelector, images.length, isOpen, onClose, onSelectIndex, selectedIndex]);

  if (!isOpen || images.length === 0 || !current) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="상품 이미지 전체 보기"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-semibold text-slate-700">
            {current.label || `이미지 ${selectedIndex + 1}`}
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="이미지 모달 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="relative min-h-0 flex-1 bg-slate-950"
            onTouchStart={(event) => {
              touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              if (touchStartXRef.current == null) return;
              const endX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
              const delta = endX - touchStartXRef.current;
              if (Math.abs(delta) >= 40) {
                onSelectIndex(
                  clampIndex(
                    selectedIndex + (delta < 0 ? 1 : -1),
                    images.length,
                  ),
                );
              }
              touchStartXRef.current = null;
            }}
          >
            <Image
              src={current.url}
              alt={current.alt}
              fill
              sizes="100vw"
              className="object-contain"
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onSelectIndex(clampIndex(selectedIndex - 1, images.length))
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-3 py-2 text-sm font-semibold text-white transition hover:bg-black/65"
                  aria-label="이전 이미지"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSelectIndex(clampIndex(selectedIndex + 1, images.length))
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-3 py-2 text-sm font-semibold text-white transition hover:bg-black/65"
                  aria-label="다음 이미지"
                >
                  →
                </button>
              </>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex gap-2 overflow-x-auto md:hidden">
              {images.map((image, index) => (
                <button
                  key={`${image.url}-${index}`}
                  type="button"
                  onClick={() => onSelectIndex(index)}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border ${
                    selectedIndex === index
                      ? "border-[#1E3A8A] ring-2 ring-[#bfdbfe]"
                      : "border-slate-200 opacity-80 hover:opacity-100"
                  }`}
                >
                  <Image src={image.url} alt={image.alt} fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>

            <div className="hidden grid-cols-4 gap-2 md:grid lg:grid-cols-6">
              {images.map((image, index) => (
                <button
                  key={`${image.url}-grid-${index}`}
                  type="button"
                  onClick={() => onSelectIndex(index)}
                  className={`relative aspect-square overflow-hidden rounded-lg border ${
                    selectedIndex === index
                      ? "border-[#1E3A8A] ring-2 ring-[#bfdbfe]"
                      : "border-slate-200 opacity-80 hover:opacity-100"
                  }`}
                >
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

