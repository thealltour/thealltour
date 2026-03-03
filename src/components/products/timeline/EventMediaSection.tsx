"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "lucide-react";

const MAX_THUMBNAILS = 8;

export type EventMediaImage = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
};

function ImageWithFallback({
  src,
  alt,
  fill,
  className,
  sizes,
  unoptimized = true,
}: {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  unoptimized?: boolean;
}) {
  const [error, setError] = useState(false);
  if (error || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--surface-muted)] text-[var(--text-muted)] ${fill ? "absolute inset-0" : ""} ${className ?? ""}`}
        aria-hidden
      >
        <ImageIcon className="h-8 w-8 opacity-50" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      unoptimized={unoptimized}
      onError={() => setError(true)}
    />
  );
}

function getCoverImage(images: EventMediaImage[]): EventMediaImage | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const cover = images.find((i) => i.isCover);
  if (cover?.url?.trim()) return cover;
  const first = images[0];
  return first?.url?.trim() ? first : null;
}

function sortedImages(images: EventMediaImage[]): EventMediaImage[] {
  if (!Array.isArray(images) || images.length === 0) return [];
  return [...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export type EventMediaSectionProps = {
  images: EventMediaImage[];
  normalizeUrl: (url: string) => string;
  onOpenLightbox: (index: number, triggerButton: HTMLButtonElement) => void;
  eventTitle?: string;
};

export function EventMediaSection({
  images,
  normalizeUrl,
  onOpenLightbox,
  eventTitle = "이벤트",
}: EventMediaSectionProps) {
  const sorted = sortedImages(images);
  const cover = getCoverImage(sorted);
  if (!cover) return null;

  const thumbnails = sorted.slice(0, MAX_THUMBNAILS);
  const hasMultiple = sorted.length > 1;

  return (
    <div className="space-y-3">
      {/* 대표 이미지: 16:9 */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[var(--surface-muted)] shadow-sm">
        <button
          type="button"
          onClick={(e) => onOpenLightbox(0, e.currentTarget)}
          className="absolute inset-0 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-inset focus:ring-offset-0"
          aria-label={`${eventTitle} 대표 이미지 크게 보기`}
        >
          <ImageWithFallback
            src={normalizeUrl(cover.url)}
            alt={cover.alt ?? eventTitle}
            fill
            className="object-cover transition hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, 560px"
            unoptimized
          />
        </button>
      </div>

      {/* 썸네일 스트립: 최대 8개, 가로 스크롤, 스크롤바 숨김 */}
      {hasMultiple && thumbnails.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {thumbnails.map((img, idx) => (
              <button
                key={`${img.url}-${idx}`}
                type="button"
                onClick={(e) => onOpenLightbox(idx, e.currentTarget)}
                className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] transition hover:border-[var(--primary)]/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
                aria-label={`이미지 ${idx + 1} 보기`}
              >
                <ImageWithFallback
                  src={normalizeUrl(img.url)}
                  alt={img.alt ?? `이미지 ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="112px"
                  unoptimized
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 크게 보기 */}
      <div>
        <button
          type="button"
          onClick={(e) => onOpenLightbox(0, e.currentTarget)}
          className="rounded text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
          aria-label={`${eventTitle} 이미지 ${sorted.length}장 크게 보기`}
        >
          크게 보기
        </button>
      </div>
    </div>
  );
}
