/**
 * Social repository contracts (STEP 3-5).
 * Server-side only consumers: future OAuth, Publication Orchestrator, PerformanceCollector.
 */

import type {
  IdentityGrantBinding,
  ProviderIdentity,
  SocialAccount,
  SocialAccountStatus,
} from "@/lib/marketing/social/domain/accounts";
import type {
  AuthorizationGrant,
  AuthorizationGrantStatus,
  PermissionGrant,
} from "@/lib/marketing/social/domain/authorization";
import type { CredentialFamily } from "@/lib/marketing/social/domain/capabilityStatus";
import type { CredentialReference } from "@/lib/marketing/social/domain/credentials";
import type { SocialChannel, SocialProvider } from "@/lib/marketing/social/domain/providers";
import type {
  SocialPerformanceMetricValueRow,
  SocialPerformanceSnapshotRow,
  SocialPublicationRow,
} from "@/lib/marketing/social/persistence/types";
import type { PublicationStatus } from "@/lib/marketing/social/publication/types";

export type UpsertProviderIdentityInput = {
  provider: SocialProvider;
  kind: string;
  externalId: string;
  displayName?: string | null;
  channelHints?: SocialChannel[];
  extension?: Record<string, string | number | boolean | null>;
};

export type CreateCredentialReferenceInput = {
  storeKind?: string;
  storeHandle: string;
  provider: SocialProvider;
  family: CredentialFamily;
};

export type CreateAuthorizationGrantInput = {
  provider: SocialProvider;
  credentialRef: CredentialReference;
  /** When creating via repository, credential row may already exist by id */
  credentialReferenceId?: string;
  credentialFamily: CredentialFamily;
  status?: AuthorizationGrantStatus;
  permissions?: PermissionGrant[];
  issuedAt?: string | null;
  expiresAt?: string | null;
  refreshSupported?: boolean;
  reauthorizationRequired?: boolean;
  providerIdentityIds?: string[];
};

export type RegisterSocialAccountInput = {
  provider: SocialProvider;
  channel: SocialChannel;
  providerIdentityId: string;
  externalIdentityId: string;
  displayName?: string | null;
  status?: SocialAccountStatus;
  activeAuthorizationGrantId?: string | null;
};

export type CreatePendingPublicationInput = {
  contentId?: string | null;
  aiPublicationId?: string | null;
  socialAccountId: string;
  provider: SocialProvider;
  channel: SocialChannel;
  mediaType?: string | null;
  idempotencyKey: string;
  governanceDecision?: string | null;
  governanceRunId?: string | null;
  humanApprovalRef?: string | null;
};

export type CreatePerformanceSnapshotInput = {
  provider: SocialProvider;
  channel: SocialChannel;
  scope: "account" | "publication";
  socialAccountId: string;
  socialPublicationId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  measuredAt?: string;
  dataAvailability?: "available" | "partial" | "unavailable";
  metrics: Array<{ metricType: string; metricValue: number; unit?: string | null }>;
};

export type ResolvedAccountAuthorization = {
  account: SocialAccount;
  identity: ProviderIdentity;
  binding: IdentityGrantBinding;
  grant: AuthorizationGrant;
  credentialRef: CredentialReference;
};

/**
 * Authoritative authorization check result.
 * Soft pointer never overrides binding state.
 */
export type AccountAuthorizationResolution =
  | { usable: true; resolved: ResolvedAccountAuthorization }
  | {
      usable: false;
      reason: string;
      account: SocialAccount;
      identity: ProviderIdentity | null;
      softPointerGrantId: string | null;
    };

export type ReauthorizeIdentityInput = {
  providerIdentityId: string;
  socialAccountIds?: string[];
  previousGrantId: string;
  newCredential: CreateCredentialReferenceInput;
  newGrant: Omit<CreateAuthorizationGrantInput, "credentialRef" | "credentialReferenceId">;
};

export type ReauthorizeIdentityResult = {
  credentialReferenceId: string;
  credentialRef: CredentialReference;
  grant: AuthorizationGrant;
  bindings: IdentityGrantBinding[];
  updatedAccounts: SocialAccount[];
};

export type SocialRepository = {
  upsertProviderIdentity(input: UpsertProviderIdentityInput): Promise<ProviderIdentity>;
  getProviderIdentityById(id: string): Promise<ProviderIdentity | null>;
  findProviderIdentity(
    provider: SocialProvider,
    kind: string,
    externalId: string,
  ): Promise<ProviderIdentity | null>;

  createCredentialReference(input: CreateCredentialReferenceInput): Promise<{
    id: string;
    ref: CredentialReference;
  }>;
  getCredentialReferenceById(id: string): Promise<{ id: string; ref: CredentialReference } | null>;

  createAuthorizationGrant(input: CreateAuthorizationGrantInput): Promise<AuthorizationGrant>;
  getAuthorizationGrantById(id: string): Promise<AuthorizationGrant | null>;
  updateAuthorizationGrantStatus(
    id: string,
    status: AuthorizationGrantStatus,
    patch?: Partial<{
      expiresAt: string | null;
      reauthorizationRequired: boolean;
      refreshSupported: boolean;
    }>,
  ): Promise<AuthorizationGrant>;

  bindIdentityToGrant(input: {
    providerIdentityId: string;
    authorizationGrantId: string;
  }): Promise<IdentityGrantBinding>;
  revokeBinding(bindingId: string): Promise<IdentityGrantBinding>;
  findActiveBinding(
    providerIdentityId: string,
    authorizationGrantId?: string,
  ): Promise<IdentityGrantBinding | null>;
  listBindingsForIdentity(providerIdentityId: string): Promise<IdentityGrantBinding[]>;

  registerSocialAccount(input: RegisterSocialAccountInput): Promise<SocialAccount>;
  getSocialAccountById(id: string): Promise<SocialAccount | null>;
  findSocialAccount(input: {
    provider: SocialProvider;
    channel: SocialChannel;
    externalIdentityId: string;
  }): Promise<SocialAccount | null>;
  updateSocialAccountStatus(id: string, status: SocialAccountStatus): Promise<SocialAccount>;
  setSocialAccountSoftGrantPointer(
    accountId: string,
    grantId: string | null,
  ): Promise<SocialAccount>;
  resolveProviderIdentityForAccount(accountId: string): Promise<ProviderIdentity | null>;

  /**
   * Authoritative usability: active binding + usable grant.
   * Stale soft pointer alone never returns usable=true.
   */
  resolveAccountAuthorization(accountId: string): Promise<AccountAuthorizationResolution>;

  /** Atomic reauthorization for same ProviderIdentity. */
  reauthorizeIdentity(input: ReauthorizeIdentityInput): Promise<ReauthorizeIdentityResult>;

  createPendingPublication(input: CreatePendingPublicationInput): Promise<SocialPublicationRow>;
  getPublicationById(id: string): Promise<SocialPublicationRow | null>;
  findPublicationByIdempotency(
    socialAccountId: string,
    idempotencyKey: string,
  ): Promise<SocialPublicationRow | null>;
  updatePublicationStatus(
    id: string,
    status: PublicationStatus | "unknown",
    patch?: Partial<{
      externalPostId: string | null;
      externalUrl: string | null;
      publishedAt: string | null;
      providerStatusMetadata: Record<string, unknown>;
    }>,
  ): Promise<SocialPublicationRow>;
  listPublicationsForContent(contentId: string): Promise<SocialPublicationRow[]>;
  listPublicationsForAccount(socialAccountId: string): Promise<SocialPublicationRow[]>;

  createPerformanceSnapshot(input: CreatePerformanceSnapshotInput): Promise<{
    snapshot: SocialPerformanceSnapshotRow;
    metrics: SocialPerformanceMetricValueRow[];
  }>;
  listPerformanceSnapshots(input: {
    socialAccountId?: string;
    socialPublicationId?: string;
    from?: string;
    to?: string;
  }): Promise<
    Array<{
      snapshot: SocialPerformanceSnapshotRow;
      metrics: SocialPerformanceMetricValueRow[];
    }>
  >;
};
