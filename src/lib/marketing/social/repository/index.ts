export type {
  SocialRepository,
  AccountAuthorizationResolution,
  ResolvedAccountAuthorization,
  UpsertProviderIdentityInput,
  CreateCredentialReferenceInput,
  CreateAuthorizationGrantInput,
  RegisterSocialAccountInput,
  CreatePendingPublicationInput,
  CreatePerformanceSnapshotInput,
  ReauthorizeIdentityInput,
  ReauthorizeIdentityResult,
} from "@/lib/marketing/social/repository/contracts";

export {
  SocialRepositoryError,
  SocialInvariantError,
  SocialIdempotencyConflictError,
  SocialAuthorizationNotUsableError,
} from "@/lib/marketing/social/repository/errors";

export {
  assertProviderChannelCompatible,
  assertAccountMatchesIdentity,
  assertGrantUsable,
  assertActiveAuthorizationForAccount,
  assertOpaquePersistenceInput,
} from "@/lib/marketing/social/repository/invariants";

export {
  toSafeSocialAccountProjection,
  toSafeAuthorizationProjection,
  toSafePublicationProjection,
  toSafePerformanceSnapshotProjection,
} from "@/lib/marketing/social/repository/projections";
export type {
  SafeSocialAccountProjection,
  SafeAuthorizationProjection,
  SafePublicationProjection,
  SafePerformanceSnapshotProjection,
} from "@/lib/marketing/social/repository/projections";

export { InMemorySocialRepository } from "@/lib/marketing/social/repository/inMemorySocialRepository";
export {
  createInMemorySocialRepository,
  isSocialRepositoryConfigured,
} from "@/lib/marketing/social/repository/createSocialRepository";

