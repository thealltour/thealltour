/**
 * Official SNS capability registry — STEP 3-2 verified findings only.
 * No live API calls. conditional/unknown never collapse to boolean true.
 */

import {
  CHANNEL_PROVIDER,
  type SocialChannel,
  type SocialMediaType,
  type SocialProvider,
} from "@/lib/marketing/social/domain/providers";
import {
  isFullySupported,
  type AutomationClassification,
  type CapabilityConfidence,
  type CapabilityPrerequisiteCode,
  type CapabilityStatus,
  type CredentialFamily,
  type VerificationStatus,
} from "@/lib/marketing/social/domain/capabilityStatus";

export type SocialIntegrationCapability = {
  provider: SocialProvider;
  channel: SocialChannel;
  publication: CapabilityStatus;
  accountMetrics: CapabilityStatus;
  publicationMetrics: CapabilityStatus;
  publicationPrerequisites: CapabilityPrerequisiteCode[];
  metricsPrerequisites: CapabilityPrerequisiteCode[];
  supportedMediaTypes: SocialMediaType[];
  automationClassification: AutomationClassification;
  credentialFamilies: CredentialFamily[];
  officialApiPreferred: true;
  browserAutomationAllowed: false;
  /** True when humans may publish even if API_AUTOMATION is planned */
  humanPublishFallback: boolean;
  verificationStatus: VerificationStatus;
  confidence: CapabilityConfidence;
  officialSources: readonly string[];
  /** Short architecture notes — not copied vendor prose */
  notes: string;
  /** Facts future schema must accommodate (no migration in 3-2) */
  futureSchemaNotes: readonly string[];
};

function entry(input: Omit<SocialIntegrationCapability, "provider" | "officialApiPreferred" | "browserAutomationAllowed">): SocialIntegrationCapability {
  return {
    ...input,
    provider: CHANNEL_PROVIDER[input.channel],
    officialApiPreferred: true,
    browserAutomationAllowed: false,
  };
}

/**
 * Channel matrix from official developer documentation (STEP 3-2).
 * Values are not guesses about consumer-app features.
 */
export const SOCIAL_CAPABILITY_REGISTRY: readonly SocialIntegrationCapability[] = [
  entry({
    channel: "instagram",
    publication: "conditional",
    accountMetrics: "conditional",
    publicationMetrics: "conditional",
    publicationPrerequisites: [
      "professional_or_business_account",
      "page_or_channel_ownership",
      "oauth_user_authorization",
      "app_review_or_permission_approval",
      "quota_or_rate_limits",
    ],
    metricsPrerequisites: [
      "professional_or_business_account",
      "oauth_user_authorization",
      "app_review_or_permission_approval",
    ],
    supportedMediaTypes: ["image", "carousel", "video", "reel", "story"],
    automationClassification: "API_AUTOMATION",
    credentialFamilies: ["oauth2_user", "oauth2_page_or_channel", "app_client_credentials"],
    humanPublishFallback: true,
    verificationStatus: "verified_official_docs",
    confidence: "high",
    officialSources: [
      "https://developers.facebook.com/docs/instagram-platform/content-publishing",
      "https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media_publish/",
      "https://developers.facebook.com/docs/instagram-platform/insights",
    ],
    notes:
      "Instagram Content Publishing + Insights via Graph API. Professional IG account; container then media_publish; insights permissions separate from publish.",
    futureSchemaNotes: [
      "ig_user_id",
      "media_container_id",
      "ig_media_id after publish",
      "status_code on container",
      "24h publish rate window",
    ],
  }),
  entry({
    channel: "facebook",
    publication: "conditional",
    accountMetrics: "conditional",
    publicationMetrics: "conditional",
    publicationPrerequisites: [
      "page_or_channel_ownership",
      "page_access_token",
      "oauth_user_authorization",
      "app_review_or_permission_approval",
    ],
    metricsPrerequisites: [
      "page_or_channel_ownership",
      "page_access_token",
      "app_review_or_permission_approval",
    ],
    supportedMediaTypes: ["text", "link", "image", "video", "carousel"],
    automationClassification: "API_AUTOMATION",
    credentialFamilies: ["oauth2_user", "oauth2_page_or_channel", "app_client_credentials"],
    humanPublishFallback: true,
    verificationStatus: "verified_official_docs",
    confidence: "high",
    officialSources: [
      "https://developers.facebook.com/docs/pages-api/posts/",
      "https://developers.facebook.com/docs/graph-api/reference/page/feed/",
      "https://developers.facebook.com/docs/graph-api/reference/page/photos/",
    ],
    notes:
      "Pages API can publish feed/photo/video as the Page. Requires Page token and CREATE_CONTENT (or equivalent) tasks. Insights are a separate product surface.",
    futureSchemaNotes: ["page_id", "page_post_id", "photo_id", "scheduled_publish_time"],
  }),
  entry({
    channel: "threads",
    publication: "conditional",
    accountMetrics: "conditional",
    publicationMetrics: "conditional",
    publicationPrerequisites: [
      "oauth_user_authorization",
      "app_review_or_permission_approval",
      "quota_or_rate_limits",
    ],
    metricsPrerequisites: ["oauth_user_authorization", "app_review_or_permission_approval"],
    supportedMediaTypes: ["text", "image", "video", "carousel", "link"],
    automationClassification: "API_AUTOMATION",
    credentialFamilies: ["oauth2_user", "app_client_credentials"],
    humanPublishFallback: true,
    verificationStatus: "verified_official_docs",
    confidence: "high",
    officialSources: [
      "https://developers.facebook.com/docs/threads/posts/",
      "https://developers.facebook.com/docs/threads/insights/",
    ],
    notes:
      "Threads API: create container then threads_publish. Insights via media insights and threads_insights. Permissions threads_content_publish / threads_manage_insights are separate.",
    futureSchemaNotes: [
      "threads_user_id",
      "creation_id",
      "threads_media_id",
      "insights since/until unix window",
    ],
  }),
  entry({
    channel: "youtube",
    publication: "conditional",
    accountMetrics: "conditional",
    publicationMetrics: "conditional",
    publicationPrerequisites: [
      "page_or_channel_ownership",
      "oauth_user_authorization",
      "quota_or_rate_limits",
    ],
    metricsPrerequisites: ["page_or_channel_ownership", "oauth_user_authorization"],
    supportedMediaTypes: ["video", "reel"],
    automationClassification: "PARTIAL_API",
    credentialFamilies: ["oauth2_user", "app_client_credentials"],
    humanPublishFallback: true,
    verificationStatus: "verified_official_docs",
    confidence: "high",
    officialSources: [
      "https://developers.google.com/youtube/v3/docs/videos/insert",
      "https://developers.google.com/youtube/v3/guides/uploading_a_video",
      "https://developers.google.com/youtube/analytics",
    ],
    notes:
      "YouTube Data API uploads video (incl. Shorts as video). No text/image feed posts. Analytics/Reporting APIs are separate from Data API upload and need channel-owner OAuth.",
    futureSchemaNotes: ["youtube_video_id", "privacyStatus", "upload_quota_units", "analytics_dimensions"],
  }),
  entry({
    channel: "naver_blog",
    publication: "conditional",
    accountMetrics: "unsupported",
    publicationMetrics: "unsupported",
    publicationPrerequisites: ["oauth_user_authorization"],
    metricsPrerequisites: [],
    supportedMediaTypes: ["text", "image", "link"],
    automationClassification: "PARTIAL_API",
    credentialFamilies: ["oauth2_user", "app_client_credentials"],
    humanPublishFallback: true,
    verificationStatus: "verified_official_docs",
    confidence: "medium",
    officialSources: [
      "https://developers.naver.com/docs/common/openapiguide/apilist.md",
      "https://naver.github.io/naver-openapi-guide/apilist.html",
      "https://developers.naver.com/docs/blog/post/",
    ],
    notes:
      "Official Blog writePost (login Open API) exists; requires Naver Login token plus registered app client credentials (see credentialFamilies). No verified official Insights API for own-blog metrics — unsupported.",
    futureSchemaNotes: ["blog_post_id_from_write_response", "category_id"],
  }),
  entry({
    channel: "naver_band",
    publication: "conditional",
    accountMetrics: "unknown",
    publicationMetrics: "unknown",
    publicationPrerequisites: ["oauth_user_authorization", "page_or_channel_ownership"],
    metricsPrerequisites: [],
    supportedMediaTypes: ["text", "image"],
    automationClassification: "PARTIAL_API",
    credentialFamilies: ["oauth2_user", "app_client_credentials"],
    humanPublishFallback: true,
    verificationStatus: "verified_official_docs",
    confidence: "medium",
    officialSources: [
      "https://developers.band.us/develop/guide/api",
      "https://developers.band.us/develop/guide/api/write_post",
    ],
    notes:
      "BAND Open API write_post creates posts (returns post_key). Official analytics/insights surface for marketing KPIs is not clearly documented — metrics unknown.",
    futureSchemaNotes: ["band_key", "post_key", "photo_key_if_media"],
  }),
  entry({
    channel: "kakao_channel",
    publication: "unsupported",
    accountMetrics: "unsupported",
    publicationMetrics: "unsupported",
    publicationPrerequisites: ["biz_partner_or_dealer_contract"],
    metricsPrerequisites: [],
    supportedMediaTypes: [],
    automationClassification: "HUMAN_PUBLISH",
    credentialFamilies: ["biz_partner_api_key", "none_documented"],
    humanPublishFallback: true,
    verificationStatus: "verified_official_docs",
    confidence: "medium",
    officialSources: [
      "https://developers.kakao.com/docs/ko/kakaotalk-channel/common",
      "https://developers.kakao.com/docs/ko/kakaotalk-message/common",
    ],
    notes:
      "Kakao Developers Channel APIs cover relationship/add-friend UX, not Instagram-like feed publishing. Customer messaging (알림톡/친구톡) is Kakao Business / dealer territory — not modeled as MarketingPost→SNS feed publish here.",
    futureSchemaNotes: ["channel_public_id", "optional_bizmessage_template_id_if_ever_bridged"],
  }),
  entry({
    channel: "tiktok",
    publication: "conditional",
    accountMetrics: "unknown",
    publicationMetrics: "conditional",
    publicationPrerequisites: [
      "oauth_user_authorization",
      "app_review_or_permission_approval",
      "provider_app_audit",
      "verified_media_host_domain",
      "quota_or_rate_limits",
    ],
    metricsPrerequisites: ["oauth_user_authorization", "app_review_or_permission_approval"],
    supportedMediaTypes: ["video", "image", "reel"],
    automationClassification: "PARTIAL_API",
    credentialFamilies: ["oauth2_user", "app_client_credentials"],
    humanPublishFallback: true,
    verificationStatus: "verified_official_docs",
    confidence: "high",
    officialSources: [
      "https://developers.tiktok.com/doc/content-posting-api-get-started",
      "https://developers.tiktok.com/doc/content-posting-api-reference-direct-post",
      "https://developers.tiktok.com/products/content-posting-api/",
    ],
    notes:
      "Content Posting API supports direct video/photo with publish_id status. Unaudited clients restricted to private. Account-level marketing analytics product surface remains less clear than publish — account metrics unknown; publication metrics conditional via Display/query products.",
    futureSchemaNotes: ["open_id", "publish_id", "privacy_level", "creator_info_preflight"],
  }),
];

export function listSocialCapabilities(): readonly SocialIntegrationCapability[] {
  return SOCIAL_CAPABILITY_REGISTRY;
}

export function getSocialCapability(
  channel: SocialChannel,
): SocialIntegrationCapability | undefined {
  return SOCIAL_CAPABILITY_REGISTRY.find((item) => item.channel === channel);
}

export function getSocialCapabilityForProviderChannel(
  provider: SocialProvider,
  channel: SocialChannel,
): SocialIntegrationCapability | undefined {
  const item = getSocialCapability(channel);
  if (!item || item.provider !== provider) return undefined;
  return item;
}

/** Strict: only unconditional `supported`. Conditional must not become true. */
export function isPublicationSupported(channel: SocialChannel): boolean {
  const status = getSocialCapability(channel)?.publication;
  return status != null && isFullySupported(status);
}

export function isAccountMetricsSupported(channel: SocialChannel): boolean {
  const status = getSocialCapability(channel)?.accountMetrics;
  return status != null && isFullySupported(status);
}

export function isPublicationMetricsSupported(channel: SocialChannel): boolean {
  const status = getSocialCapability(channel)?.publicationMetrics;
  return status != null && isFullySupported(status);
}

export function getAutomationClassification(
  channel: SocialChannel,
): AutomationClassification | undefined {
  return getSocialCapability(channel)?.automationClassification;
}

export function listChannelsByAutomation(
  classification: AutomationClassification,
): SocialChannel[] {
  return SOCIAL_CAPABILITY_REGISTRY.filter((item) => item.automationClassification === classification).map(
    (item) => item.channel,
  );
}
