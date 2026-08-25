export {
  SOCIAL_PROVIDERS,
  SOCIAL_CHANNELS,
  CHANNEL_PROVIDER,
  SOCIAL_MEDIA_TYPES,
  isSocialProvider,
  isSocialChannel,
  providerForChannel,
  assertSocialProvider,
  assertSocialChannel,
} from "@/lib/marketing/social/domain/providers";
export type {
  SocialProvider,
  SocialChannel,
  SocialMediaType,
} from "@/lib/marketing/social/domain/providers";

export {
  CAPABILITY_STATUSES,
  AUTOMATION_CLASSIFICATIONS,
  VERIFICATION_STATUSES,
  CAPABILITY_CONFIDENCE,
  CAPABILITY_PREREQUISITE_CODES,
  CREDENTIAL_FAMILIES,
  isCapabilityStatus,
  isFullySupported,
  isConditionallyAvailable,
  isCapabilityActionable,
} from "@/lib/marketing/social/domain/capabilityStatus";
export type {
  CapabilityStatus,
  AutomationClassification,
  VerificationStatus,
  CapabilityConfidence,
  CapabilityPrerequisiteCode,
  CredentialFamily,
} from "@/lib/marketing/social/domain/capabilityStatus";

export {
  FUTURE_SOCIAL_PERSISTENCE_CONCEPTS,
  THREAD_MARKETING_POSTS_NOT_EXTERNAL_PUBLICATION_MODEL,
} from "@/lib/marketing/social/domain/entities";
export type {
  MarketingPostRef,
  ExternalPublicationRef,
  PerformanceSnapshotRef,
  FutureSocialPersistenceConcept,
} from "@/lib/marketing/social/domain/entities";

export {
  SOCIAL_ACCOUNT_STATUSES,
  assertSocialAccountProviderChannelConsistency,
  isSocialAccountStatus,
} from "@/lib/marketing/social/domain/accounts";
export type {
  SocialAccount,
  SocialAccountStatus,
  ProviderIdentity,
  IdentityGrantBinding,
  IdentityGrantBindingStatus,
} from "@/lib/marketing/social/domain/accounts";

export {
  AUTHORIZATION_GRANT_STATUSES,
  isAuthorizationGrantStatus,
  isAuthorizationGrantUsable,
  authorizationHasPermission,
  listAuthorizationPermissions,
} from "@/lib/marketing/social/domain/authorization";
export type {
  AuthorizationGrant,
  AuthorizationGrantStatus,
  PermissionGrant,
} from "@/lib/marketing/social/domain/authorization";

export {
  FORBIDDEN_RAW_CREDENTIAL_KEYS,
  DISALLOWED_DEFAULT_CREDENTIAL_STORE_TARGETS,
  isForbiddenRawCredentialKey,
  assertNoRawCredentialMaterial,
  createCredentialReference,
} from "@/lib/marketing/social/domain/credentials";
export type {
  CredentialReference,
  CredentialLifecycleHint,
  CredentialStore,
} from "@/lib/marketing/social/domain/credentials";

export { evaluatePublicationEligibility } from "@/lib/marketing/social/eligibility/evaluatePublicationEligibility";
export type {
  PublicationEligibilityInput,
  PublicationEligibilityResult,
  PublicationEligibilityFactor,
  GovernanceDecisionForEligibility,
} from "@/lib/marketing/social/eligibility/evaluatePublicationEligibility";

export {
  buildMetaMultiIdentityExample,
  buildMetaGrantReplacementExample,
} from "@/lib/marketing/social/providers/meta/identityExample";

export {
  PUBLICATION_STATUSES,
  assertPublicationAdapterSurface,
} from "@/lib/marketing/social/publication/types";
export type {
  PublicationStatus,
  PublicationRequest,
  PublicationResult,
  PublicationError,
  PublicationAdapter,
} from "@/lib/marketing/social/publication/types";

export {
  PUBLICATION_ORCHESTRATOR_CALLER,
  PUBLICATION_ADAPTER_FORBIDDEN_CALLERS,
  PUBLICATION_FLOW_INACTIVE,
  SNS_SIDE_EFFECTS_STEP_3_1,
  SNS_SIDE_EFFECTS_STEP_3_2,
  SNS_SIDE_EFFECTS_STEP_3_3,
  SNS_SIDE_EFFECTS_STEP_3_4,
  SNS_SIDE_EFFECTS_STEP_3_5,
  isAllowedPublicationAdapterCaller,
  assertCanInvokePublicationAdapter,
  assertPerformanceAnalystDoesNotCallCollector,
} from "@/lib/marketing/social/publication/governanceBoundary";
export type {
  PublicationAdapterCaller,
  ForbiddenPublicationAdapterCaller,
} from "@/lib/marketing/social/publication/governanceBoundary";

export { assertPerformanceCollectorSurface } from "@/lib/marketing/social/performance/types";
export type {
  DateRange,
  NormalizedMetric,
  AccountPerformance,
  PublicationPerformance,
  PerformanceCollector,
} from "@/lib/marketing/social/performance/types";

export {
  SOCIAL_CAPABILITY_REGISTRY,
  listSocialCapabilities,
  getSocialCapability,
  getSocialCapabilityForProviderChannel,
  isPublicationSupported,
  isAccountMetricsSupported,
  isPublicationMetricsSupported,
  getAutomationClassification,
  listChannelsByAutomation,
} from "@/lib/marketing/social/providers/capabilityRegistry";
export type { SocialIntegrationCapability } from "@/lib/marketing/social/providers/capabilityRegistry";

export {
  createUnsupportedPublicationAdapter,
  createUnsupportedPerformanceCollector,
} from "@/lib/marketing/social/providers/unsupported";

export {
  SOCIAL_PERSISTENCE_TABLES,
  SOCIAL_PERSISTENCE_FORBIDDEN_COLUMNS,
  SOCIAL_CREDENTIAL_OWNERSHIP_CHAIN,
  assertSocialPersistenceDtoHasNoSecrets,
} from "@/lib/marketing/social/persistence/types";
export type {
  SocialPersistenceTable,
  SocialCredentialReferenceRow,
  SocialAuthorizationGrantRow,
  SocialProviderIdentityRow,
  SocialIdentityGrantBindingRow,
  SocialAccountRow,
  SocialPublicationRow,
  SocialPerformanceSnapshotRow,
  SocialPerformanceMetricValueRow,
} from "@/lib/marketing/social/persistence/types";

export {
  SocialRepositoryError,
  SocialInvariantError,
  SocialIdempotencyConflictError,
} from "@/lib/marketing/social/repository/errors";
export {
  assertProviderChannelCompatible,
  assertActiveAuthorizationForAccount,
} from "@/lib/marketing/social/repository/invariants";
export {
  toSafeSocialAccountProjection,
  toSafeAuthorizationProjection,
  toSafePublicationProjection,
} from "@/lib/marketing/social/repository/projections";
export type {
  SafeSocialAccountProjection,
  SafeAuthorizationProjection,
} from "@/lib/marketing/social/repository/projections";
export { createInMemorySocialRepository } from "@/lib/marketing/social/repository/createSocialRepository";
export { InMemorySocialRepository } from "@/lib/marketing/social/repository/inMemorySocialRepository";
export type {
  SocialRepository,
  AccountAuthorizationResolution,
} from "@/lib/marketing/social/repository/contracts";
