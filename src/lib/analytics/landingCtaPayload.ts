import type { ProductLandingData } from "@/types/productLanding";

export function buildLandingCtaPayload(
  data: ProductLandingData,
  section: "hero" | "recommended_products" | "bottom_cta",
) {
  return {
    landingType: data.type,
    taxonomySlug: data.taxonomySlug ?? data.slug ?? null,
    taxonomyName: data.taxonomyName ?? null,
    section,
  };
}
