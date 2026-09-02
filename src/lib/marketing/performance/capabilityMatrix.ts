/**
 * Read-only metrics capability matrix — OUR_CURRENT_ACCOUNT/API_CAPABILITY.
 * Platform theoretical API support is documented separately in social capability registry.
 */

import type { SocialChannel } from "@/lib/marketing/social/domain/providers";
import { getSocialCapability } from "@/lib/marketing/social/providers/capabilityRegistry";

export type ReadMetricsImplementationState =
  | "supported"
  | "conditional"
  | "unsupported"
  | "unknown";

export type PlatformReadMetricsCapability = {
  platform: string;
  channel: SocialChannel;
  metricsSupport: ReadMetricsImplementationState;
  officialApi: boolean;
  readOnlyEndpoint: boolean;
  accountOwnershipRequired: boolean;
  credentialRequired: boolean;
  externalPostIdRequired: boolean;
  urlAccepted: boolean;
  knownMetrics: string[];
  knownMetricDelayHours?: number | null;
  rateQuotaNotes?: string | null;
  implementationState: ReadMetricsImplementationState;
  notes: string;
};

const PLATFORM_CHANNEL_MAP: Record<string, SocialChannel> = {
  threads: "threads",
  instagram: "instagram",
  facebook: "facebook",
  youtube: "youtube",
  naver_blog: "naver_blog",
  naver_band: "naver_band",
  kakao_channel: "kakao_channel",
  tiktok: "tiktok",
};

function mapImplementationState(
  registryStatus: string | undefined,
): ReadMetricsImplementationState {
  if (registryStatus === "supported") return "supported";
  if (registryStatus === "conditional") return "conditional";
  if (registryStatus === "unsupported") return "unsupported";
  return "unknown";
}

export function resolvePlatformChannel(platform: string): SocialChannel | null {
  return PLATFORM_CHANNEL_MAP[platform.trim().toLowerCase()] ?? null;
}

export function getPlatformReadMetricsCapability(platform: string): PlatformReadMetricsCapability | null {
  const channel = resolvePlatformChannel(platform);
  if (!channel) return null;
  const cap = getSocialCapability(channel);
  if (!cap) return null;

  const metricsSupport = mapImplementationState(cap.publicationMetrics);
  const implementationState: ReadMetricsImplementationState =
    metricsSupport === "supported" ? "conditional" : metricsSupport;

  return {
    platform: platform.trim().toLowerCase(),
    channel,
    metricsSupport,
    officialApi: cap.officialApiPreferred,
    readOnlyEndpoint: true,
    accountOwnershipRequired: cap.metricsPrerequisites.includes("page_or_channel_ownership"),
    credentialRequired: cap.metricsPrerequisites.some((p) =>
      ["oauth_user_authorization", "page_access_token", "app_review_or_permission_approval"].includes(p),
    ),
    externalPostIdRequired: true,
    urlAccepted: true,
    knownMetrics: ["impressions", "reach", "likes", "comments", "shares", "views"],
    knownMetricDelayHours: 24,
    rateQuotaNotes: "Provider-specific quotas; no aggressive polling in STEP 3-9",
    implementationState,
    notes: cap.notes,
  };
}

export function listPlatformReadMetricsCapabilities(): PlatformReadMetricsCapability[] {
  return Object.keys(PLATFORM_CHANNEL_MAP).map((platform) => getPlatformReadMetricsCapability(platform)!);
}
