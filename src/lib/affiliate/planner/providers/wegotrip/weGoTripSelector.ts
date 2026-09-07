import type { WeGoTripProduct } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripTypes";

function normalizeLex(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9가-힣\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lexicalScore(product: WeGoTripProduct, placeName: string | null | undefined): number {
  const place = normalizeLex(placeName ?? "");
  if (!place || place.length < 2) return 0;
  const hay = normalizeLex(`${product.title} ${product.category ?? ""}`);
  if (!hay) return 0;
  if (hay.includes(place)) return 100;
  const tokens = place.split(" ").filter((t) => t.length >= 2);
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits += 1;
  }
  if (hits === 0) return 0;
  return Math.min(90, hits * 20);
}

export type WeGoTripSelection = {
  product: WeGoTripProduct;
  /** True when placeName lexical relevance clearly matched. */
  placeMatched: boolean;
};

/**
 * Deterministic product pick: availability → placeName lexical boost → API order → id.
 */
export function selectWeGoTripProduct(params: {
  products: WeGoTripProduct[];
  placeName?: string | null;
}): WeGoTripSelection | null {
  const candidates = params.products.filter((p) => {
    if (!p.available) return false;
    if (!p.id || !p.title || !p.slug) return false;
    if (!p.city?.id || !p.city.slug) return false;
    return true;
  });
  if (candidates.length === 0) return null;

  const scored = candidates.map((product, index) => ({
    product,
    index,
    score: lexicalScore(product, params.placeName),
  }));

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.score > 0) {
      const ratingA = a.product.rating ?? -1;
      const ratingB = b.product.rating ?? -1;
      if (ratingA !== ratingB) return ratingB - ratingA;
    }
    if (a.index !== b.index) return a.index - b.index;
    return a.product.id - b.product.id;
  });

  const best = scored[0];
  if (!best) return null;
  return { product: best.product, placeMatched: best.score >= 40 };
}

/**
 * Official documented product URL (Travelpayouts / WeGoTrip API docs).
 * https://wegotrip.com/${city-slug}-d${city-id}/${product-slug}-p${product-id}/
 */
export function buildWeGoTripProductUrl(product: WeGoTripProduct): string | null {
  const citySlug = product.city.slug.trim();
  const productSlug = product.slug.trim();
  if (!/^[a-z0-9-]+$/i.test(citySlug)) return null;
  if (!/^[a-z0-9-]+$/i.test(productSlug)) return null;
  if (!Number.isInteger(product.city.id) || product.city.id <= 0) return null;
  if (!Number.isInteger(product.id) || product.id <= 0) return null;

  return `https://wegotrip.com/${citySlug}-d${product.city.id}/${productSlug}-p${product.id}/`;
}
