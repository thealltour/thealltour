import type { Product } from "@/types/product";
import type { ImageFileNamingMode, ImageOutputFormat, ProductImageEntry } from "./imageDownload.types";

const MAX_SLUG_LEN = 48;

function sanitizeFilenamePart(raw: string, maxLen: number): string {
  const s = raw
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\-_]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!s) return "item";
  return s.length > maxLen ? s.slice(0, maxLen).replace(/-$/, "") : s;
}

/** 상품 제목 + id 앞 8자리 기반 prefix */
export function buildProductImageSlugPrefix(product: Product): string {
  const idCompact = product.id.replace(/-/g, "").slice(0, 8);
  const titleSlug = sanitizeFilenamePart(product.title || "product", MAX_SLUG_LEN);
  const combined = `${titleSlug}-${idCompact}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return combined || `product-${idCompact}`;
}

function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export type BuildProductImageFilenameOptions = {
  format: ImageOutputFormat;
  namingMode?: ImageFileNamingMode;
  /**
   * `namingMode === "simple"` 이고 cover/gallery가 아닌 항목에 대해 1-based 순번
   * (호출부에서 루프마다 증가)
   */
  simpleOtherIndex?: number;
};

export function buildProductImageFilename(
  product: Product,
  entry: ProductImageEntry,
  options: BuildProductImageFilenameOptions,
): string {
  const namingMode = options.namingMode ?? "detailed";
  const ext = options.format === "jpg" ? "jpg" : "png";

  if (namingMode === "simple") {
    if (entry.source === "cover") {
      return `cover.${ext}`;
    }
    if (entry.source === "gallery") {
      return `gallery_${pad2(entry.index + 1)}.${ext}`;
    }
    const n = options.simpleOtherIndex ?? 1;
    return `image_${pad2(n)}.${ext}`;
  }

  const slug = buildProductImageSlugPrefix(product);
  const nn = (d?: number) => pad2(d ?? entry.index + 1);
  const ee = () => pad2((entry.eventIndex ?? 0) + 1);
  const ii = () => pad2(entry.imageIndexInEvent ?? 1);
  const eventSlug = sanitizeFilenamePart(
    entry.eventHeading?.trim() || "event",
    32,
  );

  switch (entry.source) {
    case "cover":
      return `${slug}__cover.${ext}`;
    case "gallery":
      return `${slug}__gallery-${pad2(entry.index + 1)}.${ext}`;
    case "itinerary-media":
      return `${slug}__day-${nn(entry.dayNumber)}__timeline-cover.${ext}`;
    case "structured-day-cover":
      return `${slug}__day-${nn(entry.dayNumber)}__structured-cover.${ext}`;
    case "structured-event-image":
      return `${slug}__day-${nn(entry.dayNumber)}__event-${ee()}__${eventSlug}-${ii()}.${ext}`;
    case "v2-day-cover":
      return `${slug}__day-${nn(entry.dayNumber)}__v2-cover.${ext}`;
    case "v2-event-image":
      return `${slug}__day-${nn(entry.dayNumber)}__v2-event-${ee()}__${eventSlug}-${ii()}.${ext}`;
    case "catalog":
      return `${slug}__catalog-${pad2(entry.index + 1)}.${ext}`;
    case "overview-cover":
      return `${slug}__overview-cover.${ext}`;
  }
}

/** ZIP 내부 파일명 충돌 시 `-2`, `-3` … 접미사 부여 */
export function uniquifyZipEntryName(used: Set<string>, filename: string): string {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }
  const m = filename.match(/^(.+)(\.[^.]+)$/);
  const base = m ? m[1] : filename;
  const ext = m ? m[2] : "";
  let n = 2;
  let candidate = `${base}-${n}${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base}-${n}${ext}`;
  }
  used.add(candidate);
  return candidate;
}
