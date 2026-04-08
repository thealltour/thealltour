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
  if (list.length > 0) return list[0];
  return product.image_url?.trim() || "";
}
