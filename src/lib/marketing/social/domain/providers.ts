/**
 * Official SNS integration — provider vs channel (STEP 3-1 contracts only).
 * provider !== channel. No OAuth, secrets, or live API calls here.
 */

export const SOCIAL_PROVIDERS = [
  "meta",
  "google",
  "naver",
  "kakao",
  "tiktok",
] as const;

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const SOCIAL_CHANNELS = [
  "instagram",
  "facebook",
  "threads",
  "youtube",
  "naver_blog",
  "naver_band",
  "kakao_channel",
  "tiktok",
] as const;

export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

/** Which official API vendor owns a marketing channel. */
export const CHANNEL_PROVIDER: Record<SocialChannel, SocialProvider> = {
  instagram: "meta",
  facebook: "meta",
  threads: "meta",
  youtube: "google",
  naver_blog: "naver",
  naver_band: "naver",
  kakao_channel: "kakao",
  tiktok: "tiktok",
};

export const SOCIAL_MEDIA_TYPES = [
  "text",
  "image",
  "carousel",
  "video",
  "reel",
  "story",
  "link",
] as const;

export type SocialMediaType = (typeof SOCIAL_MEDIA_TYPES)[number];

export function isSocialProvider(value: string): value is SocialProvider {
  return (SOCIAL_PROVIDERS as readonly string[]).includes(value);
}

export function isSocialChannel(value: string): value is SocialChannel {
  return (SOCIAL_CHANNELS as readonly string[]).includes(value);
}

export function providerForChannel(channel: SocialChannel): SocialProvider {
  return CHANNEL_PROVIDER[channel];
}

export function assertSocialProvider(value: string): SocialProvider {
  if (!isSocialProvider(value)) {
    throw new Error(`Unknown social provider: ${value}`);
  }
  return value;
}

export function assertSocialChannel(value: string): SocialChannel {
  if (!isSocialChannel(value)) {
    throw new Error(`Unknown social channel: ${value}`);
  }
  return value;
}
