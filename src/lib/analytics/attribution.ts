import type { FirstTouch } from "@/types/inquiry";

export type AttributionResult = {
  acquisition_channel: string | null;
  acquisition_source_label: string | null;
  acquisition_medium: string | null;
  acquisition_summary: string | null;
  first_landing_path: string | null;
};

/**
 * URL 또는 referrer 문자열에서 hostname 추출. null-safe.
 */
export function parseHostname(value?: string | null): string | null {
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.hostname?.toLowerCase() || null;
  } catch {
    return null;
  }
}

const PAID_MEDIUMS = new Set(["cpc", "paid", "ppc", "ads"]);
const SOCIAL_MEDIUMS = new Set(["social", "sns"]);

function matchReferrer(hostname: string | null): {
  source_label: string;
  channel: string;
  medium: string;
} | null {
  if (!hostname) return null;
  const h = hostname.toLowerCase();

  if (h.includes("google")) return { source_label: "google", channel: "organic", medium: "organic" };
  if (h === "naver.com" || h === "search.naver.com" || h === "m.search.naver.com")
    return { source_label: "naver", channel: "organic", medium: "organic" };
  if (h.includes("bing")) return { source_label: "bing", channel: "organic", medium: "organic" };
  if (h === "instagram.com" || h === "l.instagram.com")
    return { source_label: "instagram", channel: "social", medium: "social" };
  if (h === "facebook.com" || h === "m.facebook.com" || h === "lm.facebook.com")
    return { source_label: "facebook", channel: "social", medium: "social" };
  if (h === "x.com" || h === "twitter.com" || h === "t.co")
    return { source_label: "x", channel: "social", medium: "social" };
  if (h.includes("kakao") || h.includes("pf.kakao") || h.includes("channel.kakao") || h.includes("story.kakao"))
    return { source_label: "kakao", channel: "social", medium: "social" };

  return { source_label: hostname, channel: "referral", medium: "referral" };
}

function extractPathFromLandingUrl(firstLandingUrl?: string | null): string | null {
  if (firstLandingUrl == null || typeof firstLandingUrl !== "string") return null;
  const trimmed = firstLandingUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed || "/";
  try {
    const url = new URL(trimmed);
    return url.pathname || "/";
  } catch {
    return null;
  }
}

/**
 * first_touch 원본값을 기반으로 유입경로 자동 분류.
 */
export function inferAttribution(firstTouch?: FirstTouch | null): AttributionResult {
  const first_landing_path = extractPathFromLandingUrl(firstTouch?.firstLandingUrl);

  if (!firstTouch) {
    return {
      acquisition_channel: "direct",
      acquisition_source_label: "direct",
      acquisition_medium: "none",
      acquisition_summary: "direct",
      first_landing_path,
    };
  }

  const utmSource = firstTouch.utm_source?.trim() || null;
  const utmMedium = (firstTouch.utm_medium?.trim() || "").toLowerCase();

  if (utmSource) {
    let acquisition_channel: string;
    if (PAID_MEDIUMS.has(utmMedium)) acquisition_channel = "paid";
    else if (SOCIAL_MEDIUMS.has(utmMedium)) acquisition_channel = "social";
    else if (utmMedium === "organic") acquisition_channel = "organic";
    else acquisition_channel = utmMedium || "unknown";

    return {
      acquisition_channel,
      acquisition_source_label: utmSource,
      acquisition_medium: utmMedium || "unknown",
      acquisition_summary: `${utmSource} / ${utmMedium || "unknown"}`,
      first_landing_path,
    };
  }

  const referrer = firstTouch.firstReferrer?.trim() || null;
  const hostname = parseHostname(referrer);
  const ref = matchReferrer(hostname);

  if (ref) {
    return {
      acquisition_channel: ref.channel,
      acquisition_source_label: ref.source_label,
      acquisition_medium: ref.medium,
      acquisition_summary: `${ref.source_label} / ${ref.medium}`,
      first_landing_path,
    };
  }

  return {
    acquisition_channel: "direct",
    acquisition_source_label: "direct",
    acquisition_medium: "none",
    acquisition_summary: "direct",
    first_landing_path,
  };
}
