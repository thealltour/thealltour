"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

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
        <Icon name="image" decorative size={32} className="opacity-50" />
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

/** 배열 순서 유지 (PR8.x). url 없는 항목은 제외해 렌더 깨짐 방지 */
function inDisplayOrder(images: EventMediaImage[]): EventMediaImage[] {
  if (!Array.isArray(images) || images.length === 0) return [];
  return images.filter((i) => i?.url?.trim());
}

export type EventMediaSectionProps = {
  images: EventMediaImage[];
  normalizeUrl: (url: string) => string;
  /** 미전달 시 대표 이미지는 클릭 불가, 「크게 보기」도 숨김 */
  onOpenLightbox?: (index: number, triggerButton: HTMLButtonElement) => void;
  eventTitle?: string;
  /** compact: 하나투어형 소형 가로 갤러리 (타임라인 기본) */
  variant?: "hero" | "compact";
};

const COMPACT_MAX = 5;

export function EventMediaSection({
  images,
  normalizeUrl,
  onOpenLightbox,
  eventTitle = "이벤트",
  variant = "compact",
}: EventMediaSectionProps) {
  const inOrder = inDisplayOrder(images);
  const cover = getCoverImage(inOrder);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!cover) return null;

  if (variant === "compact") {
    const thumbnails = inOrder.slice(0, COMPACT_MAX);
    const canOpenLightbox = typeof onOpenLightbox === "function";

    return (
      <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
        {thumbnails.map((img, idx) => {
          const thumb = (
            <ImageWithFallback
              src={normalizeUrl(img.url)}
              alt={img.alt ?? `${eventTitle} 이미지 ${idx + 1}`}
              fill
              className="object-cover"
              sizes="112px"
              unoptimized
            />
          );
          return canOpenLightbox ? (
            <button
              key={`${img.url}-${idx}`}
              type="button"
              onClick={(e) => onOpenLightbox(idx, e.currentTarget)}
              className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] shadow-sm transition hover:border-[var(--primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
              aria-label={`${eventTitle} 이미지 ${idx + 1} 크게 보기`}
            >
              {thumb}
            </button>
          ) : (
            <div
              key={`${img.url}-${idx}`}
              className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] shadow-sm"
            >
              {thumb}
            </div>
          );
        })}
      </div>
    );
  }

  /** hero: 대표 16:9 + 썸네일 스트립 */
  const displayImage = inOrder[selectedIndex] ?? inOrder[0];
  const hasMultiple = inOrder.length > 1;
  const thumbnails = inOrder.slice(0, MAX_THUMBNAILS);
  const canOpenLightbox = typeof onOpenLightbox === "function";

  const mainImage = (
    <ImageWithFallback
      src={normalizeUrl(displayImage.url)}
      alt={displayImage.alt ?? eventTitle}
      fill
      className={`object-cover ${canOpenLightbox ? "transition hover:scale-[1.02]" : ""}`}
      sizes="(max-width: 768px) 100vw, 560px"
      unoptimized
    />
  );

  return (
    <div className="space-y-3">
      {/* 대표 이미지: 썸네일 선택 반영. onOpenLightbox 있을 때만 클릭으로 확대 */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[var(--surface-muted)] shadow-sm">
        {canOpenLightbox ? (
          <button
            type="button"
            onClick={(e) => onOpenLightbox(selectedIndex, e.currentTarget)}
            className="absolute inset-0 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-inset focus:ring-offset-0"
            aria-label={`${eventTitle} 대표 이미지 크게 보기`}
          >
            {mainImage}
          </button>
        ) : (
          <div className="absolute inset-0">{mainImage}</div>
        )}
      </div>

      {/* 썸네일 스트립: 클릭 시 대표 이미지만 변경 */}
      {hasMultiple && thumbnails.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {thumbnails.map((img, idx) => (
              <button
                key={`${img.url}-${idx}`}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border bg-[var(--surface-muted)] transition focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--surface)] ${
                  selectedIndex === idx
                    ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/30"
                    : "border-[var(--border)] hover:border-[var(--primary)]/50 hover:shadow-md"
                }`}
                aria-label={`이미지 ${idx + 1} 선택`}
                aria-pressed={selectedIndex === idx}
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

      {canOpenLightbox ? (
        <div>
          <button
            type="button"
            onClick={(e) => onOpenLightbox(selectedIndex, e.currentTarget)}
            className="rounded text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
            aria-label={`${eventTitle} 이미지 ${inOrder.length}장 크게 보기`}
          >
            크게 보기
          </button>
        </div>
      ) : null}
    </div>
  );
}
