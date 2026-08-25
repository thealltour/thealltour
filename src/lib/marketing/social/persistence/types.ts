/**
 * Persistence DTOs matching STEP 3-4 social schema.
 * No raw credential fields. No network I/O.
 */

import type { CredentialFamily } from "@/lib/marketing/social/domain/capabilityStatus";
import type { SocialAccountStatus } from "@/lib/marketing/social/domain/accounts";
import type { AuthorizationGrantStatus, PermissionGrant } from "@/lib/marketing/social/domain/authorization";
import type { PublicationStatus } from "@/lib/marketing/social/publication/types";
import type { SocialChannel, SocialProvider } from "@/lib/marketing/social/domain/providers";

/** Columns that must never exist on social persistence DTOs. */
export const SOCIAL_PERSISTENCE_FORBIDDEN_COLUMNS = [
  "access_token",
  "refresh_token",
  "accessToken",
  "refreshToken",
  "client_secret",
  "clientSecret",
  "api_key",
  "apiKey",
  "authorization_code",
  "oauth_code",
] as const;

export type SocialCredentialReferenceRow = {
  id: string;
  storeKind: string;
  storeHandle: string;
  provider: SocialProvider | string;
  credentialFamily: CredentialFamily | string;
  createdAt: string;
  updatedAt: string;
};

export type SocialAuthorizationGrantRow = {
  id: string;
  provider: SocialProvider | string;
  credentialReferenceId: string;
  credentialFamily: CredentialFamily | string;
  status: AuthorizationGrantStatus | string;
  permissions: PermissionGrant[];
  issuedAt?: string | null;
  expiresAt?: string | null;
  refreshSupported: boolean;
  reauthorizationRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SocialProviderIdentityRow = {
  id: string;
  provider: SocialProvider | string;
  identityKind: string;
  externalId: string;
  displayName?: string | null;
  channelHints: string[];
  extension: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
};

export type SocialIdentityGrantBindingRow = {
  id: string;
  providerIdentityId: string;
  authorizationGrantId: string;
  status: "active" | "revoked" | string;
  createdAt: string;
  updatedAt: string;
};

export type SocialAccountRow = {
  id: string;
  provider: SocialProvider | string;
  channel: SocialChannel | string;
  providerIdentityId: string;
  externalIdentityId: string;
  displayName?: string | null;
  status: SocialAccountStatus | string;
  /** Soft pointer only — credentials owned by grant */
  activeAuthorizationGrantId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialPublicationRow = {
  id: string;
  contentId?: string | null;
  aiPublicationId?: string | null;
  socialAccountId: string;
  provider: SocialProvider | string;
  channel: SocialChannel | string;
  mediaType?: string | null;
  status: PublicationStatus | "unknown" | string;
  externalPostId?: string | null;
  externalUrl?: string | null;
  publishedAt?: string | null;
  idempotencyKey?: string | null;
  governanceDecision?: string | null;
  governanceRunId?: string | null;
  humanApprovalRef?: string | null;
  providerStatusMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SocialPerformanceSnapshotRow = {
  id: string;
  provider: SocialProvider | string;
  channel: SocialChannel | string;
  scope: "account" | "publication";
  socialAccountId: string;
  socialPublicationId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  measuredAt: string;
  dataAvailability: "available" | "partial" | "unavailable" | string;
  createdAt: string;
};

export type SocialPerformanceMetricValueRow = {
  id: string;
  snapshotId: string;
  metricType: string;
  metricValue: number;
  unit?: string | null;
  createdAt: string;
};

export const SOCIAL_PERSISTENCE_TABLES = [
  "social_credential_references",
  "social_authorization_grants",
  "social_provider_identities",
  "social_identity_grant_bindings",
  "social_accounts",
  "social_publications",
  "social_performance_snapshots",
  "social_performance_metric_values",
] as const;

export type SocialPersistenceTable = (typeof SOCIAL_PERSISTENCE_TABLES)[number];

export function assertSocialPersistenceDtoHasNoSecrets(dto: object): void {
  const keys = Object.keys(dto);
  for (const forbidden of SOCIAL_PERSISTENCE_FORBIDDEN_COLUMNS) {
    if (keys.includes(forbidden)) {
      throw new Error(`Forbidden credential column on persistence DTO: ${forbidden}`);
    }
  }
}

/** Documented relationship chain for STEP 3-4. */
export const SOCIAL_CREDENTIAL_OWNERSHIP_CHAIN =
  "SocialAccount → ProviderIdentity → IdentityGrantBinding → AuthorizationGrant → CredentialReference" as const;
