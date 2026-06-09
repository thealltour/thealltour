const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

/** 현재 브라우저 URL의 UTM 파라미터를 대상 URL에 이어붙입니다. */
export function appendUtmParamsFromSearch(
  targetUrl: string,
  sourceSearch?: string,
): string {
  if (typeof window === "undefined" && !sourceSearch) return targetUrl;

  const source = sourceSearch ?? (typeof window !== "undefined" ? window.location.search : "");
  if (!source) return targetUrl;

  const incoming = new URLSearchParams(source.startsWith("?") ? source.slice(1) : source);
  const hasUtm = UTM_KEYS.some((key) => incoming.get(key));
  if (!hasUtm) return targetUrl;

  const [path, existingQuery = ""] = targetUrl.split("?");
  const params = new URLSearchParams(existingQuery);

  for (const key of UTM_KEYS) {
    const value = incoming.get(key);
    if (value && !params.get(key)) {
      params.set(key, value);
    }
  }

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export type MarketingChannelUtm = {
  utm_source: string;
  utm_medium: string;
  utm_campaign?: string;
  utm_content?: string;
};

/** 채널별 기본 UTM 프리셋 (Admin UTM 빌더·콘텐츠 export 공용) */
export const CHANNEL_UTM_PRESETS: Record<string, MarketingChannelUtm> = {
  naver_band: { utm_source: "naver_band", utm_medium: "social" },
  naver_blog: { utm_source: "naver_blog", utm_medium: "social" },
  smartstore: { utm_source: "smartstore", utm_medium: "referral" },
  kakao_channel: { utm_source: "kakao_channel", utm_medium: "social" },
  instagram: { utm_source: "instagram", utm_medium: "social" },
  youtube: { utm_source: "youtube", utm_medium: "social" },
};

export function appendChannelUtm(
  targetUrl: string,
  channel: keyof typeof CHANNEL_UTM_PRESETS,
  campaign?: string,
): string {
  const preset = CHANNEL_UTM_PRESETS[channel];
  if (!preset) return targetUrl;

  const [path, existingQuery = ""] = targetUrl.split("?");
  const params = new URLSearchParams(existingQuery);
  params.set("utm_source", preset.utm_source);
  params.set("utm_medium", preset.utm_medium);
  if (campaign?.trim()) params.set("utm_campaign", campaign.trim());
  if (preset.utm_content) params.set("utm_content", preset.utm_content);

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function buildCampaignUrl(options: {
  basePath: string;
  channel: keyof typeof CHANNEL_UTM_PRESETS;
  campaign?: string;
  slug?: string;
}): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");

  const path = options.slug
    ? `/recommended/${encodeURIComponent(options.slug)}`
    : options.basePath.startsWith("/")
      ? options.basePath
      : `/${options.basePath}`;

  return appendChannelUtm(`${origin}${path}`, options.channel, options.campaign);
}

/** 콘텐츠 export·스마트스토어 등 채널별 상품 URL (UTM 포함) */
export function buildChannelProductUrl(
  productId: string,
  channel: keyof typeof CHANNEL_UTM_PRESETS,
  campaign?: string,
): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
  const id = productId.trim();
  if (!id) return origin;
  return appendChannelUtm(`${origin}/products/${encodeURIComponent(id)}`, channel, campaign);
}
