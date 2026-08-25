/**
 * Social account & provider identity contracts (STEP 3-3/3-4).
 * Credential ownership: AuthorizationGrant → CredentialReference only.
 */

import { CHANNEL_PROVIDER, type SocialChannel, type SocialProvider } from "@/lib/marketing/social/domain/providers";

export const SOCIAL_ACCOUNT_STATUSES = ["connected", "disconnected", "disabled"] as const;
export type SocialAccountStatus = (typeof SOCIAL_ACCOUNT_STATUSES)[number];

/**
 * Provider-recognized external identity (Page, IG professional, Threads profile, …).
 * Lifetime is independent of AuthorizationGrant. Access is via IdentityGrantBinding.
 */
export type ProviderIdentity = {
  id: string;
  provider: SocialProvider;
  /** Provider-specific kind string; Meta examples use facebook_page / instagram_professional / threads_profile */
  kind: string;
  /** Provider-native id (page id, ig user id, …) — not a secret */
  externalId: string;
  displayName?: string | null;
  /** Channels this identity can serve */
  channelHints: SocialChannel[];
  /** Non-secret extension metadata only */
  extension?: Record<string, string | number | boolean | null>;
};

export type IdentityGrantBindingStatus = "active" | "revoked";

/** Which grant can access which identity (reauth-safe). */
export type IdentityGrantBinding = {
  id: string;
  providerIdentityId: string;
  authorizationGrantId: string;
  status: IdentityGrantBindingStatus;
};

/**
 * thealltour-connected SNS account/page/channel for a marketing channel.
 * Does not own credentials — use activeAuthorizationGrantId → grant → CredentialReference.
 */
export type SocialAccount = {
  id: string;
  provider: SocialProvider;
  channel: SocialChannel;
  providerIdentityId: string;
  /** Denormalized external id for lookups */
  externalIdentityId: string;
  displayName?: string | null;
  status: SocialAccountStatus;
  /** Soft pointer to preferred grant; not the credential owner */
  activeAuthorizationGrantId?: string | null;
};

export function assertSocialAccountProviderChannelConsistency(account: SocialAccount): void {
  const expected = CHANNEL_PROVIDER[account.channel];
  if (account.provider !== expected) {
    throw new Error(
      `SocialAccount provider/channel mismatch: channel=${account.channel} expects provider=${expected}, got ${account.provider}`,
    );
  }
}

export function isSocialAccountStatus(value: string): value is SocialAccountStatus {
  return (SOCIAL_ACCOUNT_STATUSES as readonly string[]).includes(value);
}
