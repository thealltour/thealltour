"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NotionImageGroup } from "@/components/guides/NotionImageGroupCarousel";
import styles from "./ImageCollageModal.module.css";

type ImageCollageModalProps = {
  isOpen: boolean;
  group: NotionImageGroup;
  selectedIndex: number;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
};

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNicgaGVpZ2h0PScxMic+PHJlY3Qgd2lkdGg9JzE2JyBoZWlnaHQ9JzEyJyBmaWxsPScjMGIxMjIwJy8+PC9zdmc+";

function clamp(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
}

export function ImageCollageModal({
  isOpen,
  group,
  selectedIndex,
  onClose,
  onSelectIndex,
}: ImageCollageModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const current = group.images[clamp(selectedIndex, group.images.length)];

  const focusableSelector = useMemo(
    () =>
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    [],
  );

  useEffect(() => {
    if (!isOpen) return;
    setZoomed(false);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSelectIndex(clamp(selectedIndex - 1, group.images.length));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onSelectIndex(clamp(selectedIndex + 1, group.images.length));
        return;
      }
      if (event.key !== "Tab") return;

      const root = containerRef.current;
      if (!root) return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => !el.hasAttribute("disabled"),
      );
      if (!focusables.length) return;

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

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [focusableSelector, group.images.length, isOpen, onClose, onSelectIndex, selectedIndex]);

  if (!isOpen || !current) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="가이드 이미지 확대 보기"
      onClick={onClose}
    >
      <div className={styles.modal} ref={containerRef} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <p className={styles.title}>
            이미지 {clamp(selectedIndex, group.images.length) + 1} / {group.images.length}
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="이미지 모달 닫기"
          >
            닫기
          </button>
        </div>

        <div className={styles.body}>
          <section className={styles.previewPanel}>
            <div
              className={`${styles.previewViewport} ${zoomed ? styles.previewViewportZoom : ""}`}
              onDoubleClick={() => setZoomed((prev) => !prev)}
            >
              <Image
                unoptimized
                src={current.src}
                alt={current.alt}
                width={current.width ?? 1600}
                height={current.height ?? 1100}
                className={styles.previewImage}
                sizes="(max-width: 1024px) 100vw, 70vw"
                priority
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
              />
            </div>
            <p className={styles.previewCaption}>{current.caption || current.alt}</p>
            <div className={styles.navRow}>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => onSelectIndex(clamp(selectedIndex - 1, group.images.length))}
                aria-label="이전 이미지"
              >
                ← 이전
              </button>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => onSelectIndex(clamp(selectedIndex + 1, group.images.length))}
                aria-label="다음 이미지"
              >
                다음 →
              </button>
            </div>
          </section>

          <aside className={styles.collagePanel} aria-label="이미지 콜라주 목록">
            <div className={styles.grid}>
              {group.images.map((image, index) => (
                <button
                  key={`${group.groupId}-modal-thumb-${image.src}-${index}`}
                  type="button"
                  className={`${styles.gridItem} ${
                    clamp(selectedIndex, group.images.length) === index ? styles.gridItemActive : ""
                  }`}
                  onClick={() => {
                    setZoomed(false);
                    onSelectIndex(index);
                  }}
                  aria-label={`이미지 ${index + 1} 선택`}
                >
                  <Image
                    unoptimized
                    src={image.src}
                    alt={image.alt}
                    width={320}
                    height={240}
                    sizes="(max-width: 1024px) 33vw, 180px"
                    className={styles.gridImage}
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                  />
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

