"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

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

function getDistance(
  t1: { clientX: number; clientY: number },
  t2: { clientX: number; clientY: number },
): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
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
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const [scale, setScale] = useState(1);
  const [mode, setMode] = useState<"default" | "collage">("default");
  const current = images[clampIndex(selectedIndex, images.length)];

  const focusableSelector = useMemo(
    () =>
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    [],
  );

  useEffect(() => {
    if (!isOpen) return;

    previousFocusedElementRef.current = document.activeElement as HTMLElement | null;
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
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusedElementRef.current?.focus();
    };
  }, [focusableSelector, images.length, isOpen, onClose, onSelectIndex, selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;
    setScale(1);
  }, [isOpen, selectedIndex]);

  if (!isOpen || images.length === 0 || !current) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-[var(--overlay)] p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="상품 이미지 갤러리"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-2xl bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)] ring-1 ring-[var(--border)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--divider)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            {current.label || `이미지 ${selectedIndex + 1}`} · {selectedIndex + 1}/{images.length}
          </p>
          <div className="mr-2 hidden items-center gap-1 rounded-lg bg-slate-100 p-1 md:inline-flex">
            <button
              type="button"
              onClick={() => setMode("default")}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                mode === "default" ? "bg-white text-[#1E3A8A]" : "text-slate-600"
              }`}
            >
              기본
            </button>
            <button
              type="button"
              onClick={() => setMode("collage")}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                mode === "collage" ? "bg-white text-[#1E3A8A]" : "text-slate-600"
              }`}
            >
              콜라주
            </button>
          </div>
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
              if (event.touches.length >= 2) {
                pinchStartDistanceRef.current = getDistance(event.touches[0], event.touches[1]);
                pinchStartScaleRef.current = scale;
                touchStartXRef.current = null;
                return;
              }
              touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
            }}
            onTouchMove={(event) => {
              if (event.touches.length >= 2 && pinchStartDistanceRef.current) {
                const currentDistance = getDistance(event.touches[0], event.touches[1]);
                const ratio = currentDistance / pinchStartDistanceRef.current;
                const nextScale = Math.max(1, Math.min(3, pinchStartScaleRef.current * ratio));
                setScale(nextScale);
              }
            }}
            onTouchEnd={(event) => {
              if (event.changedTouches.length >= 2) {
                pinchStartDistanceRef.current = null;
                return;
              }
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
            onWheel={(event) => {
              event.preventDefault();
              const delta = event.deltaY;
              setScale((prev) => {
                const next = delta < 0 ? prev + 0.15 : prev - 0.15;
                return Math.max(1, Math.min(3, Number(next.toFixed(2))));
              });
            }}
          >
            <div className="absolute inset-0">
              <Image
                src={normalizeProductImageUrl(current.url, { width: 2200, quality: 86, mode: "contain" })}
                alt={current.alt}
                fill
                sizes="100vw"
                className="object-contain transition-transform duration-150"
                style={{ transform: `scale(${scale})` }}
              />
            </div>
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
            {scale > 1 ? (
              <button
                type="button"
                onClick={() => setScale(1)}
                className="absolute bottom-3 left-3 rounded bg-black/45 px-2 py-1 text-xs font-semibold text-white"
              >
                줌 초기화 ({Math.round(scale * 100)}%)
              </button>
            ) : null}
          </div>

          <div className="border-t border-[var(--divider)] bg-[var(--surface)] p-3">
            {mode === "default" ? (
              <>
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
                      <Image
                        src={normalizeProductImageUrl(image.url, { width: 180, quality: 68, mode: "cover" })}
                        alt={image.alt}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
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
                        src={normalizeProductImageUrl(image.url, { width: 320, quality: 70, mode: "cover" })}
                        alt={image.alt}
                        fill
                        sizes="120px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="max-h-[30vh] overflow-auto">
                <div className="columns-2 gap-2 md:columns-3">
                  {images.map((image, index) => (
                    <button
                      key={`${image.url}-collage-${index}`}
                      type="button"
                      onClick={() => onSelectIndex(index)}
                      className={`group relative mb-2 block w-full overflow-hidden rounded-lg border ${
                        selectedIndex === index
                          ? "border-[#1E3A8A] ring-2 ring-[#bfdbfe]"
                          : "border-slate-200"
                      }`}
                    >
                      <Image
                        src={normalizeProductImageUrl(image.url, { width: 480, quality: 72, mode: "cover" })}
                        alt={image.alt}
                        width={480}
                        height={320}
                        sizes="(max-width: 768px) 48vw, (max-width: 1280px) 22vw, 240px"
                        className="h-auto w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

