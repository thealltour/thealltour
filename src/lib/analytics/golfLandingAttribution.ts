/**
 * 골프 지역 랜딩 vs 단일 채널(`/products?tourType=golf-park`) 전환 비교용 계측 기준.
 *
 * 비교 축:
 * - `golf_destination_landing`: `/recommended/{dest}-golf-travel` (source_path + landing_slug)
 * - `golf_product_channel`: `/products?tourType=golf-park` (기존 채널 baseline)
 *
 * GA/내부 analytics에서 `metadata.acquisitionChannel`·`metadata.compareBaselinePath`·UTM으로 필터링합니다.
 */

import { buildGolfProductsHref } from "@/lib/products/golfChannel";

export const GOLF_PRODUCT_CHANNEL_BASELINE_PATH = buildGolfProductsHref();

export type GolfAcquisitionChannel = "golf_destination_landing" | "golf_product_channel";

export const GOLF_LANDING_UTM = {
  source: "thealltour",
  medium: "landing",
  campaign: "golf-destination",
} as const;

export function resolveGolfAcquisitionChannel(
  templateType?: string | null,
): GolfAcquisitionChannel | null {
  if (templateType === "destination_golf_consulting") return "golf_destination_landing";
  return null;
}

export function buildGolfLandingUtmParams(landingSlug: string): Record<string, string> {
  const slug = landingSlug.trim();
  return {
    utm_source: GOLF_LANDING_UTM.source,
    utm_medium: GOLF_LANDING_UTM.medium,
    utm_campaign: GOLF_LANDING_UTM.campaign,
    utm_content: slug || "unknown",
  };
}

export function buildGolfLandingAnalyticsMetadata(
  landingSlug: string,
  templateType?: string | null,
): Record<string, unknown> {
  const channel = resolveGolfAcquisitionChannel(templateType);
  if (!channel) {
    return { funnel: "landing_to_quote" };
  }
  return {
    funnel: "landing_to_quote",
    acquisitionChannel: channel,
    compareBaselinePath: GOLF_PRODUCT_CHANNEL_BASELINE_PATH,
    utm: buildGolfLandingUtmParams(landingSlug),
  };
}

export function appendGolfLandingAttributionToHref(baseHref: string, landingSlug: string): string {
  const [path, query = ""] = baseHref.split("?");
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries(buildGolfLandingUtmParams(landingSlug))) {
    params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
