import type { AdminLandingDetail } from "@/types/adminLanding";
import { appendGolfLandingAttributionToHref } from "@/lib/analytics/golfLandingAttribution";

export function buildLandingQuoteHref(landing: AdminLandingDetail, sourcePath: string): string {
  const params = new URLSearchParams();
  params.set("source_path", sourcePath);
  params.set("product_title", landing.title);
  params.set("landing_slug", landing.slug);
  if (landing.quoteCategory) {
    params.set("quote_category", landing.quoteCategory);
  }
  const base = `/quote?${params.toString()}`;
  if (landing.templateType === "destination_golf_consulting") {
    return appendGolfLandingAttributionToHref(base, landing.slug);
  }
  return base;
}
