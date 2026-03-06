/**
 * 이벤트 이미지 배열 정규화: sortOrder 연속화(0..n-1) + isCover 1개 보장.
 * EventImagesEditor, V2EventRow, StructuredEventRow, AdminProductManager에서 공통 사용.
 */

export type EventImageInput = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
};

export type EventImageNormalized = {
  url: string;
  alt?: string;
  sortOrder: number;
  isCover: boolean;
};

/**
 * 입력: event.images 형태 배열 (순서는 이미 정해진 경우 그대로 유지, 아니면 sortOrder로 정렬).
 * 처리:
 * 1) sortOrder로 정렬 후, 배열 인덱스대로 0..n-1 재할당
 * 2) isCover: 1개만 true. 여러 개 true면 첫 번째만 유지, 없으면 0번을 true
 * 반환: 정규화된 배열 (동일 타입)
 */
export function normalizeEventImages(
  images: EventImageInput[] | undefined | null,
): EventImageNormalized[] {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return [];
  }

  const sorted = [...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const hasAnyCover = sorted.some((i) => i.isCover === true);
  let coverAssigned = false;

  return sorted.map((item, index) => {
    const isCover =
      hasAnyCover
        ? item.isCover === true && !coverAssigned
        : index === 0;
    if (isCover) coverAssigned = true;
    return {
      url: item.url,
      alt: item.alt,
      sortOrder: index,
      isCover,
    };
  });
}
