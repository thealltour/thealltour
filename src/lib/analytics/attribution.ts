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

const REFERRER_CHANNEL_MAP: Array<{
  test: (hostname: string) => boolean;
  source_label: string;
  channel: string;
  medium: string;
}> = [
  {
    test: (h) => h.includes("google"),
    source_label: "google",
    channel: "organic",
    medium: "organic",
  },
  {
    test: (h) => h === "naver.com" || h === "search.naver.com" || h === "m.search.naver.com",
    source_label: "naver",
    channel: "organic",
    medium: "organic",
  },
  {
    test: (h) => h.includes("bing"),
    source_label: "bing",
    channel: "organic",
    medium: "organic",
  },
  {
    test: (h) =>
      h === "band.us" ||
      h.endsWith(".band.us") ||
      h === "band.naver.com" ||
      h.endsWith(".band.naver.com"),
    source_label: "naver_band",
    channel: "social",
    medium: "social",
  },
  {
    test: (h) =>
      h === "blog.naver.com" ||
      h === "m.blog.naver.com" ||
      h.endsWith(".blog.naver.com"),
    source_label: "naver_blog",
    channel: "social",
    medium: "social",
  },
  {
    test: (h) =>
      h === "smartstore.naver.com" ||
      h.endsWith(".smartstore.naver.com") ||
      h.includes("shopping.naver.com"),
    source_label: "smartstore",
    channel: "referral",
    medium: "referral",
  },
  {
    test: (h) =>
      h === "instagram.com" ||
      h === "l.instagram.com" ||
      h.endsWith(".instagram.com"),
    source_label: "instagram",
    channel: "social",
    medium: "social",
  },
  {
    test: (h) =>
      h === "facebook.com" ||
      h === "m.facebook.com" ||
      h === "lm.facebook.com" ||
      h.endsWith(".facebook.com"),
    source_label: "facebook",
    channel: "social",
    medium: "social",
  },
  {
    test: (h) => h === "x.com" || h === "twitter.com" || h === "t.co",
    source_label: "x",
    channel: "social",
    medium: "social",
  },
  {
    test: (h) =>
      h.includes("kakao") ||
      h.includes("pf.kakao") ||
      h.includes("channel.kakao") ||
      h.includes("story.kakao"),
    source_label: "kakao",
    channel: "social",
    medium: "social",
  },
  {
    test: (h) =>
      h === "youtube.com" ||
      h === "www.youtube.com" ||
      h === "m.youtube.com" ||
      h === "youtu.be" ||
      h.endsWith(".youtube.com"),
    source_label: "youtube",
    channel: "social",
    medium: "social",
  },
];

function matchReferrer(hostname: string | null): {
  source_label: string;
  channel: string;
  medium: string;
} | null {
  if (!hostname) return null;
  const h = hostname.toLowerCase();
  for (const rule of REFERRER_CHANNEL_MAP) {
    if (rule.test(h)) {
      return {
        source_label: rule.source_label,
        channel: rule.channel,
        medium: rule.medium,
      };
    }
  }
  return { source_label: hostname, channel: "referral", medium: "referral" };
}

/** firstLandingUrl(상대/절대 URL)에서 pathname(또는 상대 경로)만 추출 */
export function extractPathFromLandingUrl(firstLandingUrl?: string | null): string | null {
  if (firstLandingUrl == null || typeof firstLandingUrl !== "string") return null;
  const trimmed = firstLandingUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) {
    const qIndex = trimmed.indexOf("?");
    return qIndex >= 0 ? trimmed.slice(0, qIndex) || "/" : trimmed;
  }
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
    else if (utmMedium === "referral") acquisition_channel = "referral";
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
