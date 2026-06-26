/**
 * JSON-LD 추출기.
 * <script type="application/ld+json"> 파싱 → Product/BreadcrumbList 등 선별 → Import 보조 데이터로 매핑.
 */

import type { HanatourImportV1 } from "~types/hanatourImport";

export function getJsonLdObjects(): unknown[] {
  if (typeof document === "undefined") return [];
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const out: unknown[] = [];
  scripts.forEach((script) => {
    const raw = script.textContent?.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item != null && typeof item === "object") out.push(item);
        });
      } else if (parsed != null && typeof parsed === "object") {
        out.push(parsed);
      }
    } catch {
      // 파싱 실패 무시
    }
  });
  return out;
}

type JsonLdProduct = {
  "@type"?: string;
  name?: string;
  description?: string;
  image?: string | string[];
};

export function pickBestJsonLd(objs: unknown[]): {
  product?: JsonLdProduct;
  breadcrumb?: unknown;
  faq?: unknown;
} {
  let product: JsonLdProduct | undefined;
  let breadcrumb: unknown;
  let faq: unknown;

  for (const o of objs) {
    if (!o || typeof o !== "object") continue;
    const obj = o as Record<string, unknown>;
    const type = obj["@type"];
    const typeStr = typeof type === "string" ? type : Array.isArray(type) ? type[0] : "";

    if (typeStr === "Product" || (Array.isArray(type) && type.includes("Product"))) {
      const candidate = o as JsonLdProduct;
      const hasName = !!candidate.name?.trim();
      const hasImage = !!(
        candidate.image &&
        (Array.isArray(candidate.image) ? candidate.image.length > 0 : candidate.image)
      );
      const hasDesc = !!candidate.description?.trim();
      const score = (hasName ? 2 : 0) + (hasImage ? 1 : 0) + (hasDesc ? 1 : 0);
      const curScore = product
        ? (product.name ? 2 : 0) +
          (product.image && (Array.isArray(product.image) ? product.image.length > 0 : product.image) ? 1 : 0) +
          (product.description ? 1 : 0)
        : -1;
      if (score > curScore) product = candidate;
      if (!product) product = candidate;
    }
    if (typeStr === "BreadcrumbList") breadcrumb = o;
    if (typeStr === "FAQPage") faq = o;
  }

  return { product, breadcrumb, faq };
}

function normalizeImage(img: string | string[] | undefined): string[] {
  if (!img) return [];
  if (typeof img === "string") return img.trim() ? [img.trim()] : [];
  return Array.isArray(img)
    ? img.filter((u): u is string => typeof u === "string" && !!u.trim()).map((u) => u.trim())
    : [];
}

/**
 * JSON-LD Product → Import 보조 데이터 (product.title, media.heroImageUrl 등).
 * DOM보다 우선 사용할 수 있도록 Partial<HanatourImportV1> 형태로 반환.
 */
export function mapJsonLdToImport(productLd: JsonLdProduct | undefined): Partial<HanatourImportV1> | null {
  if (!productLd || typeof productLd !== "object") return null;

  const name = productLd.name?.trim();
  const description = productLd.description?.trim();
  const images = normalizeImage(productLd.image);

  if (!name && images.length === 0 && !description) return null;

  const result: Partial<HanatourImportV1> = {};
  if (name) {
    result.product = { ...result.product, title: name };
  }
  if (description) {
    result.product = { ...result.product, summary: description };
  }
  if (images.length > 0) {
    result.media = {
      heroImageUrl: images[0],
      galleryImageUrls: images,
      unassignedImageUrls: [],
    };
  }
  return Object.keys(result).length > 0 ? result : null;
}
