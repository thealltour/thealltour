import type { Product } from "@/types/product";

export function normalizeImageList(images: Array<string | null | undefined> | null | undefined): string[] {
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of images) {
    if (typeof raw !== "string") continue;
    const url = raw.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}

export function getPrimaryImageUrl(product: Pick<Product, "image_url" | "images_json">): string {
  const list = normalizeImageList(product.images_json);
  const cover = product.image_url?.trim();
  if (cover && (list.length === 0 || list.includes(cover))) return cover;
  if (list.length > 0) return list[0];
  return cover || "";
}

/** 목록 API row → Product 썸네일용 (DB image_url 우선) */
export function mapAdminListProductRow<T extends { image_url?: string | null; images_json?: unknown }>(
  item: T,
): T & { image_url: string } {
  const images = normalizeImageList(
    Array.isArray(item.images_json) ? (item.images_json as Array<string | null | undefined>) : null,
  );
  return {
    ...item,
    images_json: images,
    image_url: getPrimaryImageUrl({ image_url: item.image_url ?? "", images_json: images }),
  };
}

/** 폼 상태에서 대표 이미지 URL (image_url 우선, 없으면 갤러리 첫 장) */
export function getPrimaryImageUrlFromFormFields(
  imageUrl: string | null | undefined,
  imagesJson: Array<string | null | undefined> | null | undefined,
): string {
  const images = normalizeImageList(imagesJson ?? undefined);
  return getPrimaryImageUrl({ image_url: imageUrl ?? "", images_json: images });
}
