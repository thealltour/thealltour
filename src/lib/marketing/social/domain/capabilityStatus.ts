/**
 * Capability status (STEP 3-2).
 * Never collapse conditional/unknown into boolean true.
 */

export const CAPABILITY_STATUSES = [
  "supported",
  "unsupported",
  "conditional",
  "unknown",
] as const;

export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export const AUTOMATION_CLASSIFICATIONS = [
  "API_AUTOMATION",
  "PARTIAL_API",
  "HUMAN_PUBLISH",
] as const;

export type AutomationClassification = (typeof AUTOMATION_CLASSIFICATIONS)[number];

export const VERIFICATION_STATUSES = [
  "verified_official_docs",
  "partially_verified",
  "unknown",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const CAPABILITY_CONFIDENCE = ["high", "medium", "low"] as const;
export type CapabilityConfidence = (typeof CAPABILITY_CONFIDENCE)[number];

/** Machine-readable prerequisites — not free-form doc prose. */
export const CAPABILITY_PREREQUISITE_CODES = [
  "professional_or_business_account",
  "page_or_channel_ownership",
  "oauth_user_authorization",
  "app_review_or_permission_approval",
  "provider_app_audit",
  "page_access_token",
  "biz_partner_or_dealer_contract",
  "verified_media_host_domain",
  "quota_or_rate_limits",
] as const;

export type CapabilityPrerequisiteCode = (typeof CAPABILITY_PREREQUISITE_CODES)[number];

export const CREDENTIAL_FAMILIES = [
  "oauth2_user",
  "oauth2_page_or_channel",
  "app_client_credentials",
  "biz_partner_api_key",
  "none_documented",
] as const;

export type CredentialFamily = (typeof CREDENTIAL_FAMILIES)[number];

export function isCapabilityStatus(value: string): value is CapabilityStatus {
  return (CAPABILITY_STATUSES as readonly string[]).includes(value);
}

/** True only for fully unconditional support — not conditional/unknown. */
export function isFullySupported(status: CapabilityStatus): boolean {
  return status === "supported";
}

/** Official API exists with prerequisites (eligible for future adapter work). */
export function isConditionallyAvailable(status: CapabilityStatus): boolean {
  return status === "conditional";
}

export function isCapabilityActionable(status: CapabilityStatus): boolean {
  return status === "supported" || status === "conditional";
}
