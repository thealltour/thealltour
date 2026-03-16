"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImageIcon } from "lucide-react";
import {
  ProductImageGalleryModal,
  type ProductGalleryImage,
} from "@/components/products/ProductImageGalleryModal";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

type ProductImageCarouselProps = {
  images: ProductGalleryImage[];
  /** 이미지가 없을 때 placeholder 표시 (false면 아무것도 안 그림) */
  showPlaceholderWhenEmpty?: boolean;
};

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
}

export function ProductImageCarousel({
  images,
  showPlaceholderWhenEmpty = true,
}: ProductImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const maxDesktopThumbs = 6;

  if (!images.length) {
    if (!showPlaceholderWhenEmpty) return null;
    return (
      <section className="space-y-3" aria-label="상품 이미지 갤러리">
        <div
          className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-slate-100 text-slate-500"
          aria-hidden
        >
          <ImageIcon className="h-12 w-12 opacity-50" />
          <span className="text-sm font-medium">대표 이미지 없음</span>
        </div>
      </section>
    );
  }

  const current = images[clampIndex(activeIndex, images.length)];
  const desktopThumbs = images.slice(1, 1 + maxDesktopThumbs);
  const hiddenDesktopCount = Math.max(0, images.length - 1 - maxDesktopThumbs);
  /** PR30: 모바일 썸네일 3~4개만 노출 */
  const mobileThumbs = images.slice(0, 4);

  function openModalAt(index: number) {
    const nextIndex = clampIndex(index, images.length);
    setActiveIndex(nextIndex);
    setIsModalOpen(true);
  }

  return (
    <>
      <section className="space-y-3" aria-label="상품 이미지 갤러리">
        <div
          className="relative overflow-hidden rounded-2xl bg-slate-100 md:hidden"
          onTouchStart={(event) => {
            touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchStartXRef.current == null) return;
            const endX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
            const delta = endX - touchStartXRef.current;
            if (Math.abs(delta) >= 40) {
              setActiveIndex((prev) =>
                clampIndex(prev + (delta < 0 ? 1 : -1), images.length),
              );
            }
            touchStartXRef.current = null;
          }}
        >
          <div className="relative aspect-[4/3] w-full">
            <button
              type="button"
              onClick={() => openModalAt(activeIndex)}
              className="absolute inset-0 z-10"
              aria-label={`상품 이미지 ${activeIndex + 1}${images.length > 1 ? ` (${activeIndex + 1}/${images.length})` : ""} 크게 보기`}
            />
            <Image
              src={normalizeProductImageUrl(current.url, { width: 1400, quality: 80, mode: "cover" })}
              alt={current.alt}
              fill
              priority={activeIndex === 0}
              sizes="100vw"
              className="object-cover"
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((prev) => clampIndex(prev - 1, images.length))
                  }
                  className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/35 px-3 py-2 text-sm font-semibold text-white transition hover:bg-black/55"
                  aria-label="이전 이미지"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((prev) => clampIndex(prev + 1, images.length))
                  }
                  className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/35 px-3 py-2 text-sm font-semibold text-white transition hover:bg-black/55"
                  aria-label="다음 이미지"
                >
                  →
                </button>
              </>
            )}
            {/* PR39: 모바일 Hero 갤러리 UX - 현재 위치 / 전체 수 표시 (여러 장일 때만) */}
            {images.length > 1 && (
              <div
                className="absolute bottom-3 left-3 z-20 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white"
                aria-live="polite"
                aria-label={`현재 ${activeIndex + 1}번째, 전체 ${images.length}장`}
              >
                {activeIndex + 1} / {images.length}
              </div>
            )}
            {/* PR39: 전체 사진 보기 CTA - 여러 장이면 "사진 전체보기", 단일이면 "사진 보기" */}
            <button
              type="button"
              onClick={() => openModalAt(activeIndex)}
              className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white shadow-lg transition hover:bg-black/70 active:scale-[0.98]"
              aria-label={images.length > 1 ? `사진 ${images.length}장 전체 보기` : "사진 크게 보기"}
            >
              <Camera className="h-4 w-4 shrink-0" aria-hidden />
              {images.length > 1 ? "사진 전체보기" : "사진 보기"}
            </button>
            {/* PR39: dot indicator - 스와이프 가능성 인지 (여러 장일 때만) */}
            {images.length > 1 && (
              <div
                className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1"
                role="tablist"
                aria-label="이미지 위치"
              >
                {images.slice(0, 8).map((_, index) => (
                  <button
                    key={`dot-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={activeIndex === index}
                    aria-label={`이미지 ${index + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex(index);
                    }}
                    className={`h-1.5 rounded-full transition ${
                      activeIndex === index
                        ? "w-4 bg-white"
                        : "w-1.5 bg-white/60 hover:bg-white/80"
                    }`}
                  />
                ))}
                {images.length > 8 && (
                  <span className="ml-0.5 self-center text-[10px] font-medium text-white/90">
                    +{images.length - 8}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="hidden gap-3 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <button
            type="button"
            onClick={() => openModalAt(activeIndex)}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100"
            aria-label={`대표 이미지 ${activeIndex + 1} 확대 보기`}
          >
            <Image
              src={normalizeProductImageUrl(current.url, { width: 1600, quality: 82, mode: "cover" })}
              alt={current.alt}
              fill
              priority={activeIndex === 0}
              sizes="(max-width: 1024px) 68vw, 720px"
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
            />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
            <div className="absolute bottom-3 left-3 rounded-lg bg-black/45 px-2.5 py-1 text-xs font-semibold text-white">
              {activeIndex + 1} / {images.length}
            </div>
            <div className="absolute bottom-3 right-3 rounded-lg bg-black/45 px-3 py-1.5 text-xs font-semibold text-white">
              전체 사진 보기
            </div>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {desktopThumbs.map((image, i) => {
              const imageIndex = i + 1;
              const isLastVisible = i === desktopThumbs.length - 1;
              const showMoreOverlay = isLastVisible && hiddenDesktopCount > 0;
              return (
                <button
                  key={`${image.url}-${imageIndex}`}
                  type="button"
                  onClick={() => openModalAt(imageIndex)}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"
                  aria-label={`썸네일 이미지 ${imageIndex + 1} 확대 보기`}
                >
                  <Image
                    src={normalizeProductImageUrl(image.url, { width: 480, quality: 70, mode: "cover" })}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 1280px) 16vw, 180px"
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
                  {showMoreOverlay ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-bold text-white">
                      +{hiddenDesktopCount}
                    </div>
                  ) : null}
                </button>
              );
            })}
            {desktopThumbs.length < 4 &&
              Array.from({ length: 4 - desktopThumbs.length }).map((_, idx) => (
                <div
                  key={`empty-thumb-${idx}`}
                  className="aspect-[4/3] rounded-xl bg-slate-100/60"
                  aria-hidden="true"
                />
              ))}
          </div>
        </div>

        {images.length > 1 && (
          <div className="md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mobileThumbs.map((image, index) => (
                <button
                  key={`${image.url}-mobile-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border transition ${
                    activeIndex === index
                      ? "border-[#1E3A8A] ring-2 ring-[#bfdbfe]"
                      : "border-slate-200 opacity-90 hover:opacity-100"
                  }`}
                  aria-label={`이미지 ${index + 1} 선택`}
                >
                  <Image
                    src={normalizeProductImageUrl(image.url, { width: 240, quality: 68, mode: "cover" })}
                    alt={image.alt}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
              {images.length > 4 && (
                <button
                  type="button"
                  onClick={() => openModalAt(0)}
                  className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-600 transition hover:border-[#1E3A8A] hover:bg-[#eff6ff] hover:text-[#1E3A8A]"
                  aria-label={`사진 ${images.length}장 전체 보기`}
                >
                  +{images.length - 4}
                </button>
              )}
            </div>
          </div>
        )}

        {images.length > 1 && (
          <div className="hidden items-center justify-center gap-1.5 md:flex">
            {images.slice(0, 8).map((_, index) => (
              <button
                key={`indicator-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2 rounded-full transition ${
                  activeIndex === index
                    ? "w-6 bg-[#1E3A8A]"
                    : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`이미지 ${index + 1}로 이동`}
              />
            ))}
            {images.length > 8 ? (
              <button
                type="button"
                onClick={() => openModalAt(activeIndex)}
                className="ml-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                +{images.length - 8}
              </button>
            ) : null}
          </div>
        )}
      </section>

      <ProductImageGalleryModal
        isOpen={isModalOpen}
        images={images}
        selectedIndex={activeIndex}
        onSelectIndex={setActiveIndex}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

