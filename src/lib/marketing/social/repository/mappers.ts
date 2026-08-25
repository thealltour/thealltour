import type {
  IdentityGrantBinding,
  ProviderIdentity,
  SocialAccount,
} from "@/lib/marketing/social/domain/accounts";
import type { AuthorizationGrant, PermissionGrant } from "@/lib/marketing/social/domain/authorization";
import type { CredentialFamily } from "@/lib/marketing/social/domain/capabilityStatus";
import type { CredentialReference } from "@/lib/marketing/social/domain/credentials";
import type { SocialChannel, SocialProvider } from "@/lib/marketing/social/domain/providers";
import type {
  SocialPerformanceMetricValueRow,
  SocialPerformanceSnapshotRow,
  SocialPublicationRow,
} from "@/lib/marketing/social/persistence/types";
import { assertSocialPersistenceDtoHasNoSecrets } from "@/lib/marketing/social/persistence/types";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : value == null ? null : String(value);
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asPermissions(value: unknown): PermissionGrant[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item != null)
    .map((item) => ({
      code: asString(item.code),
      label: asStringOrNull(item.label),
    }))
    .filter((item) => item.code.length > 0);
}

function asChannelHints(value: unknown): SocialChannel[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SocialChannel => typeof item === "string") as SocialChannel[];
}

function asExtension(value: unknown): Record<string, string | number | boolean | null> {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (
      typeof child === "string" ||
      typeof child === "number" ||
      typeof child === "boolean" ||
      child === null
    ) {
      out[key] = child;
    }
  }
  return out;
}

export function mapCredentialReferenceRow(row: Record<string, unknown>): {
  id: string;
  ref: CredentialReference;
} {
  assertSocialPersistenceDtoHasNoSecrets(row);
  const ref: CredentialReference = {
    kind: "credential_reference",
    storeHandle: asString(row.store_handle),
    provider: asString(row.provider) as SocialProvider,
    family: asString(row.credential_family) as CredentialFamily,
  };
  return { id: asString(row.id), ref };
}

export function mapProviderIdentityRow(row: Record<string, unknown>): ProviderIdentity {
  assertSocialPersistenceDtoHasNoSecrets(row);
  return {
    id: asString(row.id),
    provider: asString(row.provider) as SocialProvider,
    kind: asString(row.identity_kind),
    externalId: asString(row.external_id),
    displayName: asStringOrNull(row.display_name),
    channelHints: asChannelHints(row.channel_hints),
    extension: asExtension(row.extension),
  };
}

export function mapAuthorizationGrantRow(
  row: Record<string, unknown>,
  credentialRef: CredentialReference,
): AuthorizationGrant {
  assertSocialPersistenceDtoHasNoSecrets(row);
  return {
    id: asString(row.id),
    provider: asString(row.provider) as SocialProvider,
    status: asString(row.status) as AuthorizationGrant["status"],
    credentialFamily: asString(row.credential_family) as CredentialFamily,
    permissions: asPermissions(row.permissions),
    credentialRef,
    providerIdentityIds: [],
    issuedAt: asStringOrNull(row.issued_at),
    expiresAt: asStringOrNull(row.expires_at),
    refreshSupported: asBool(row.refresh_supported),
    reauthorizationRequired: asBool(row.reauthorization_required),
  };
}

export function mapBindingRow(row: Record<string, unknown>): IdentityGrantBinding {
  assertSocialPersistenceDtoHasNoSecrets(row);
  return {
    id: asString(row.id),
    providerIdentityId: asString(row.provider_identity_id),
    authorizationGrantId: asString(row.authorization_grant_id),
    status: asString(row.status) as IdentityGrantBinding["status"],
  };
}

export function mapSocialAccountRow(row: Record<string, unknown>): SocialAccount {
  assertSocialPersistenceDtoHasNoSecrets(row);
  return {
    id: asString(row.id),
    provider: asString(row.provider) as SocialProvider,
    channel: asString(row.channel) as SocialChannel,
    providerIdentityId: asString(row.provider_identity_id),
    externalIdentityId: asString(row.external_identity_id),
    displayName: asStringOrNull(row.display_name),
    status: asString(row.status) as SocialAccount["status"],
    activeAuthorizationGrantId: asStringOrNull(row.active_authorization_grant_id),
  };
}

export function mapPublicationRow(row: Record<string, unknown>): SocialPublicationRow {
  assertSocialPersistenceDtoHasNoSecrets(row);
  const metadata =
    typeof row.provider_status_metadata === "object" &&
    row.provider_status_metadata != null &&
    !Array.isArray(row.provider_status_metadata)
      ? (row.provider_status_metadata as Record<string, unknown>)
      : {};
  return {
    id: asString(row.id),
    contentId: asStringOrNull(row.content_id),
    aiPublicationId: asStringOrNull(row.ai_publication_id),
    socialAccountId: asString(row.social_account_id),
    provider: asString(row.provider),
    channel: asString(row.channel),
    mediaType: asStringOrNull(row.media_type),
    status: asString(row.status),
    externalPostId: asStringOrNull(row.external_post_id),
    externalUrl: asStringOrNull(row.external_url),
    publishedAt: asStringOrNull(row.published_at),
    idempotencyKey: asStringOrNull(row.idempotency_key),
    governanceDecision: asStringOrNull(row.governance_decision),
    governanceRunId: asStringOrNull(row.governance_run_id),
    humanApprovalRef: asStringOrNull(row.human_approval_ref),
    providerStatusMetadata: metadata,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export function mapPerformanceSnapshotRow(row: Record<string, unknown>): SocialPerformanceSnapshotRow {
  assertSocialPersistenceDtoHasNoSecrets(row);
  return {
    id: asString(row.id),
    provider: asString(row.provider),
    channel: asString(row.channel),
    scope: asString(row.scope) as "account" | "publication",
    socialAccountId: asString(row.social_account_id),
    socialPublicationId: asStringOrNull(row.social_publication_id),
    periodStart: asStringOrNull(row.period_start),
    periodEnd: asStringOrNull(row.period_end),
    measuredAt: asString(row.measured_at),
    dataAvailability: asString(row.data_availability),
    createdAt: asString(row.created_at),
  };
}

export function mapMetricValueRow(row: Record<string, unknown>): SocialPerformanceMetricValueRow {
  assertSocialPersistenceDtoHasNoSecrets(row);
  return {
    id: asString(row.id),
    snapshotId: asString(row.snapshot_id),
    metricType: asString(row.metric_type),
    metricValue: Number(row.metric_value ?? 0),
    unit: asStringOrNull(row.unit),
    createdAt: asString(row.created_at),
  };
}
