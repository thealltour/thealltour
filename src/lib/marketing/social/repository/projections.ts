/**
 * Safe projections for agent/MCP/cron surfaces.
 * Credential store handles must not flow into prompts or AI Memory by default.
 */

import type { SocialAccount } from "@/lib/marketing/social/domain/accounts";
import type { AuthorizationGrant } from "@/lib/marketing/social/domain/authorization";
import type { SocialPublicationRow, SocialPerformanceSnapshotRow } from "@/lib/marketing/social/persistence/types";

export type SafeSocialAccountProjection = {
  id: string;
  provider: string;
  channel: string;
  providerIdentityId: string;
  externalIdentityId: string;
  displayName?: string | null;
  status: string;
  /** Whether an active binding+grant exists — never exposes store handles */
  authorizationUsable: boolean;
};

export type SafeAuthorizationProjection = {
  id: string;
  provider: string;
  status: string;
  permissionCodes: string[];
  expiresAt?: string | null;
  refreshSupported: boolean;
  reauthorizationRequired: boolean;
  /** Opaque presence only — never the store handle */
  hasCredentialReference: boolean;
};

export type SafePublicationProjection = {
  id: string;
  contentId?: string | null;
  socialAccountId: string;
  provider: string;
  channel: string;
  status: string;
  externalPostId?: string | null;
  externalUrl?: string | null;
  publishedAt?: string | null;
  governanceDecision?: string | null;
};

export type SafePerformanceSnapshotProjection = {
  id: string;
  provider: string;
  channel: string;
  scope: string;
  socialAccountId: string;
  socialPublicationId?: string | null;
  measuredAt: string;
  dataAvailability: string;
  metrics: Array<{ metricType: string; metricValue: number; unit?: string | null }>;
};

export function toSafeSocialAccountProjection(
  account: SocialAccount,
  authorizationUsable: boolean,
): SafeSocialAccountProjection {
  return {
    id: account.id,
    provider: account.provider,
    channel: account.channel,
    providerIdentityId: account.providerIdentityId,
    externalIdentityId: account.externalIdentityId,
    displayName: account.displayName ?? null,
    status: account.status,
    authorizationUsable,
  };
}

export function toSafeAuthorizationProjection(grant: AuthorizationGrant): SafeAuthorizationProjection {
  return {
    id: grant.id,
    provider: grant.provider,
    status: grant.status,
    permissionCodes: grant.permissions.map((p) => p.code),
    expiresAt: grant.expiresAt ?? null,
    refreshSupported: Boolean(grant.refreshSupported),
    reauthorizationRequired: Boolean(grant.reauthorizationRequired ?? grant.lifecycle?.reauthorizationRequired),
    hasCredentialReference: grant.credentialRef?.kind === "credential_reference",
  };
}

export function toSafePublicationProjection(row: SocialPublicationRow): SafePublicationProjection {
  return {
    id: row.id,
    contentId: row.contentId ?? null,
    socialAccountId: row.socialAccountId,
    provider: String(row.provider),
    channel: String(row.channel),
    status: String(row.status),
    externalPostId: row.externalPostId ?? null,
    externalUrl: row.externalUrl ?? null,
    publishedAt: row.publishedAt ?? null,
    governanceDecision: row.governanceDecision ?? null,
  };
}

export function toSafePerformanceSnapshotProjection(
  row: SocialPerformanceSnapshotRow,
  metrics: Array<{ metricType: string; metricValue: number; unit?: string | null }>,
): SafePerformanceSnapshotProjection {
  return {
    id: row.id,
    provider: String(row.provider),
    channel: String(row.channel),
    scope: row.scope,
    socialAccountId: row.socialAccountId,
    socialPublicationId: row.socialPublicationId ?? null,
    measuredAt: row.measuredAt,
    dataAvailability: String(row.dataAvailability),
    metrics,
  };
}
