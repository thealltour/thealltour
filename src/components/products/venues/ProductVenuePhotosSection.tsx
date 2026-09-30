"use client";

import { useMemo, useState } from "react";
import { EventMediaSection } from "@/components/products/timeline/EventMediaSection";
import { ProductImageGalleryModal } from "@/components/products/ProductImageGalleryModal";
import { normalizeVenueInfoList } from "@/lib/admin/golfCourses";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import type { VenueInfoItem } from "@/types/product";

export type ProductVenuePhotosSectionProps = {
  golfCourses: VenueInfoItem[] | null | undefined;
  hotels: VenueInfoItem[] | null | undefined;
  attractions?: VenueInfoItem[] | null;
};

type VenueKind = "golf" | "hotel" | "attraction";

type VenuePhotoGroup = {
  key: string;
  kind: VenueKind;
  kindLabel: string;
  name: string;
  content: string;
  images: string[];
};

/** EventMediaSection compact 변형이 보여주는 썸네일 수 */
const VISIBLE_THUMBNAILS = 5;

const thumbUrl = (url: string) => normalizeProductImageUrl(url, { width: 480, quality: 72, mode: "cover" });

export function buildVenuePhotoGroups(
  golfCourses: VenueInfoItem[] | null | undefined,
  hotels: VenueInfoItem[] | null | undefined,
  attractions?: VenueInfoItem[] | null,
): VenuePhotoGroup[] {
  const groups: VenuePhotoGroup[] = [];
  const sources: Array<[VenueKind, string, VenueInfoItem[] | null | undefined]> = [
    ["golf", "골프장", golfCourses],
    ["hotel", "호텔", hotels],
    ["attraction", "관광지", attractions],
  ];
  for (const [kind, kindLabel, items] of sources) {
    (normalizeVenueInfoList(items) ?? []).forEach((venue, index) => {
      if (!venue.images?.length) return;
      groups.push({
        key: `${kind}-${index}`,
        kind,
        kindLabel,
        name: venue.name,
        content: venue.content,
        images: venue.images,
      });
    });
  }
  return groups;
}

export function venuePhotosHeading(groups: VenuePhotoGroup[]): string {
  return `${[...new Set(groups.map((group) => group.kindLabel))].join("·")} 사진`;
}

/** 여행일정 미리보기 아래: 골프장·호텔·관광지별 사진 줄. 클릭하면 해당 장소의 갤러리 모달을 엽니다. */
export function ProductVenuePhotosSection({ golfCourses, hotels, attractions }: ProductVenuePhotosSectionProps) {
  const groups = useMemo(
    () => buildVenuePhotoGroups(golfCourses, hotels, attractions),
    [golfCourses, hotels, attractions],
  );
  const [active, setActive] = useState<{ groupIndex: number; imageIndex: number } | null>(null);

  const activeGroup = active ? groups[active.groupIndex] ?? null : null;
  const galleryImages = useMemo(
    () =>
      (activeGroup?.images ?? []).map((url, index) => ({
        url,
        alt: `${activeGroup?.name ?? ""} 사진 ${index + 1}`,
      })),
    [activeGroup],
  );

  if (groups.length === 0) return null;

  const heading = venuePhotosHeading(groups);

  return (
    <section
      className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 md:p-5"
      aria-label={heading}
      data-testid="product-venue-photos-section"
    >
      <h2 className="mb-4 text-lg font-bold text-[var(--primary)]">{heading}</h2>
      <div className="space-y-5">
        {groups.map((group, groupIndex) => (
          <div key={group.key}>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              <span className="mr-1.5 text-xs font-medium text-[var(--text-muted)]">{group.kindLabel}</span>
              {group.name}
            </h3>
            <EventMediaSection
              images={group.images.map((url, index) => ({ url, alt: `${group.name} 사진 ${index + 1}` }))}
              normalizeUrl={thumbUrl}
              eventTitle={group.name}
              onOpenLightbox={(imageIndex) => setActive({ groupIndex, imageIndex })}
              compactSizeMode={group.kind === "attraction" || group.images.length > 1 ? "thumbnail" : "full"}
            />
            {group.images.length > VISIBLE_THUMBNAILS ? (
              <button
                type="button"
                onClick={() => setActive({ groupIndex, imageIndex: 0 })}
                className="mt-1 text-xs font-medium text-[var(--primary)] hover:underline"
              >
                사진 {group.images.length}장 모두 보기
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <ProductImageGalleryModal
        isOpen={activeGroup != null}
        images={galleryImages}
        selectedIndex={active?.imageIndex ?? 0}
        onClose={() => setActive(null)}
        onSelectIndex={(imageIndex) =>
          setActive((prev) => (prev ? { ...prev, imageIndex } : prev))
        }
        title={activeGroup ? `${activeGroup.kindLabel} · ${activeGroup.name}` : undefined}
        description={activeGroup?.content}
        ariaLabel={activeGroup ? `${activeGroup.name} ${activeGroup.kindLabel} 사진` : undefined}
      />
    </section>
  );
}
