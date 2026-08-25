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
