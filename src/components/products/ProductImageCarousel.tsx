"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  ProductImageGalleryModal,
  type ProductGalleryImage,
} from "@/components/products/ProductImageGalleryModal";

type ProductImageCarouselProps = {
  images: ProductGalleryImage[];
};

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
}

export function ProductImageCarousel({ images }: ProductImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  if (!images.length) return null;

  const current = images[clampIndex(activeIndex, images.length)];

  return (
    <>
      <section className="space-y-3">
        <div
          className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-100 md:aspect-[4/3]"
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
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="absolute inset-0 z-10"
            aria-label="상품 이미지 크게 보기"
          />
          <Image
            src={current.url}
            alt={current.alt}
            fill
            priority={activeIndex === 0}
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 70vw, 900px"
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
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="absolute bottom-3 right-3 z-20 rounded-lg bg-black/45 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/65"
          >
            전체 보기
          </button>
        </div>

        {images.length > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {images.map((_, index) => (
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

