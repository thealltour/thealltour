import type { AdminLandingDetail } from "@/types/adminLanding";

export function buildLandingQuoteHref(landing: AdminLandingDetail, sourcePath: string): string {
  const params = new URLSearchParams();
  params.set("source_path", sourcePath);
  params.set("product_title", landing.title);
  params.set("landing_slug", landing.slug);
  if (landing.quoteCategory) {
    params.set("quote_category", landing.quoteCategory);
  }
  return `/quote?${params.toString()}`;
}
