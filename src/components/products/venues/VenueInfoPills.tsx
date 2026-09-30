"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { ProductImageGalleryModal } from "@/components/products/ProductImageGalleryModal";
import { normalizeVenueInfoList } from "@/lib/admin/golfCourses";
import type { VenueInfoItem } from "@/types/product";

export type VenueInfoPillsProps = {
  items: VenueInfoItem[] | null | undefined;
  /** 모달 제목·접근성 이름에 붙는 종류 (예: 골프장, 호텔) */
  kindLabel: string;
};

/**
 * 골프장·호텔 이름 알약 버튼. 사진이 있으면 갤러리 모달(이름·설명 포함), 없으면 설명 모달을 엽니다.
 */
export function VenueInfoPills({ items, kindLabel }: VenueInfoPillsProps) {
  const venues = useMemo(() => normalizeVenueInfoList(items) ?? [], [items]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const active = activeIndex != null ? venues[activeIndex] ?? null : null;
  const galleryImages = useMemo(
    () =>
      (active?.images ?? []).map((url, index) => ({
        url,
        alt: `${active?.name ?? kindLabel} 사진 ${index + 1}`,
      })),
    [active, kindLabel],
  );

  if (venues.length === 0) return null;

  const close = () => setActiveIndex(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {venues.map((venue, index) => {
          const photoCount = venue.images?.length ?? 0;
          return (
            <button
              key={`${venue.name}-${index}`}
              type="button"
              onClick={() => {
                setImageIndex(0);
                setActiveIndex(index);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
              aria-label={
                photoCount > 0
                  ? `${venue.name} ${kindLabel} 사진 ${photoCount}장 보기`
                  : `${venue.name} ${kindLabel} 정보 보기`
              }
            >
              {venue.name}
              {photoCount > 0 ? (
                <Icon name="image" decorative size={14} className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      <ProductImageGalleryModal
        isOpen={active != null && galleryImages.length > 0}
        images={galleryImages}
        selectedIndex={imageIndex}
        onClose={close}
        onSelectIndex={setImageIndex}
        title={active?.name}
        description={active?.content}
        ariaLabel={active ? `${active.name} ${kindLabel} 사진` : undefined}
      />

      <Modal
        isOpen={active != null && galleryImages.length === 0}
        onClose={close}
        aria-label={active ? `${active.name} ${kindLabel} 정보` : `${kindLabel} 정보`}
        className="w-full max-w-2xl"
      >
        {active ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{active.name}</h3>
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                닫기
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
              {active.content}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
