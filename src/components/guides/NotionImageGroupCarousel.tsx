"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import styles from "./NotionImageGroupCarousel.module.css";
import type { GuideImage, GuideBlock } from "@/lib/notion";

const ImageCollageModal = dynamic(
  () =>
    import("./ImageCollageModal").then((module) => ({
      default: module.ImageCollageModal,
    })),
  { ssr: false },
);

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNicgaGVpZ2h0PScxMic+PHJlY3Qgd2lkdGg9JzE2JyBoZWlnaHQ9JzEyJyBmaWxsPScjMGIxMjIwJy8+PC9zdmc+";

export type NotionGroupImage = GuideImage;
export type NotionImageGroup = Extract<GuideBlock, { type: "image_group" }>;

type NotionImageGroupCarouselProps = {
  group: NotionImageGroup;
};

function clamp(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
}

export function NotionImageGroupCarousel({ group }: NotionImageGroupCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const images = group.images;

  const activeImage = useMemo(
    () => images[clamp(activeIndex, images.length)],
    [activeIndex, images],
  );

  if (!images.length || !activeImage) return null;

  return (
    <>
      <figure className={styles.block}>
        <div
          className={styles.viewport}
          onTouchStart={(event) => {
            touchStartX.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchStartX.current == null) return;
            const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
            const delta = endX - touchStartX.current;
            if (Math.abs(delta) >= 40) {
              setActiveIndex((prev) => clamp(prev + (delta < 0 ? 1 : -1), images.length));
            }
            touchStartX.current = null;
          }}
        >
          <button
            type="button"
            className={styles.openButton}
            onClick={() => setIsModalOpen(true)}
            aria-label="이미지 모달 열기"
          />
          <Image
            unoptimized
            src={activeImage.src}
            alt={activeImage.alt}
            width={activeImage.width ?? 1440}
            height={activeImage.height ?? 960}
            sizes="(max-width: 768px) 100vw, 760px"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className={styles.mainImage}
          />

          {images.length > 1 ? (
            <>
              <button
                type="button"
                className={`${styles.navButton} ${styles.navPrev}`}
                onClick={() => setActiveIndex((prev) => clamp(prev - 1, images.length))}
                aria-label="이전 이미지"
              >
                ←
              </button>
              <button
                type="button"
                className={`${styles.navButton} ${styles.navNext}`}
                onClick={() => setActiveIndex((prev) => clamp(prev + 1, images.length))}
                aria-label="다음 이미지"
              >
                →
              </button>
            </>
          ) : null}
        </div>

        {activeImage.caption ? (
          <figcaption className={styles.caption}>{activeImage.caption}</figcaption>
        ) : null}

        {images.length > 1 ? (
          <div className={styles.indicatorRow} aria-label="이미지 슬라이드 인디케이터">
            {images.map((image, index) => (
              <button
                key={`${group.groupId}-dot-${image.src}-${index}`}
                type="button"
                className={`${styles.dot} ${activeIndex === index ? styles.dotActive : ""}`}
                onClick={() => setActiveIndex(index)}
                aria-label={`이미지 ${index + 1} 보기`}
                aria-current={activeIndex === index ? "true" : "false"}
              />
            ))}
          </div>
        ) : null}

        {images.length > 1 ? (
          <div className={styles.thumbnailRow}>
            {images.map((image, index) => (
              <button
                key={`${group.groupId}-thumb-${image.src}-${index}`}
                type="button"
                className={`${styles.thumbnailButton} ${
                  activeIndex === index ? styles.thumbnailButtonActive : ""
                }`}
                onClick={() => setActiveIndex(index)}
                aria-label={`썸네일 ${index + 1} 선택`}
              >
                <Image
                  unoptimized
                  src={image.src}
                  alt={image.alt}
                  width={160}
                  height={120}
                  sizes="80px"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className={styles.thumbnailImage}
                />
              </button>
            ))}
          </div>
        ) : null}
      </figure>

      <ImageCollageModal
        isOpen={isModalOpen}
        group={group}
        selectedIndex={activeIndex}
        onClose={() => setIsModalOpen(false)}
        onSelectIndex={setActiveIndex}
      />
    </>
  );
}

