export { MARKETING_ASSET_ROOT_ENV, resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
export {
  MEDIA_BRIEF_CONTRACT,
  MARKETING_ASSET_MANIFEST_CONTRACT,
  MARKETING_ASSET_EXPORT_CONTEXT_CONTRACT,
  MARKETING_ASSET_STAGE,
  MARKETING_ASSET_ARTIFACT_KINDS,
  MARKETING_ASSET_ARTIFACT_ORIGINS,
  CARD_NEWS_ROLES,
  mediaBriefSchema,
  marketingAssetManifestSchema,
  type MediaBrief,
  type MediaBriefFactualClaim,
  type CardNewsBrief,
  type CardNewsCard,
  type ShortformBrief,
  type ShortformNarrationSegment,
  type MarketingAssetArtifact,
  type MarketingAssetManifest,
  type MarketingAssetStage,
  type MarketingAssetArtifactKind,
  type MarketingAssetArtifactOrigin,
} from "@/lib/marketing/assets/contracts";
export {
  MarketingAssetConfigError,
  MarketingAssetPathError,
  MarketingAssetConflictError,
  MarketingAssetContractError,
  MarketingAssetExportError,
  CardNewsNotApplicableError,
  CardNewsRenderOverflowError,
  CardNewsVisualError,
  VideoShotError,
  VIDEO_SHOT_ERROR_CODES,
  type VideoShotErrorCode,
  VideoClipError,
  VIDEO_CLIP_ERROR_CODES,
  type VideoClipErrorCode,
  VideoPreviewError,
  VIDEO_PREVIEW_ERROR_CODES,
  type VideoPreviewErrorCode,
} from "@/lib/marketing/assets/errors";
export {
  MARKETING_ASSET_GENERATED_DIRECTORIES,
  MARKETING_ASSET_HUMAN_EDITED_DIRECTORY,
  MARKETING_ASSET_PUBLISHED_DIRECTORY,
  MARKETING_ASSET_PACKAGE_DIRECTORIES,
  assertSafeCandidateId,
  assertSafeRelativeArtifactPath,
  splitBusinessDateParts,
  resolvePackageDirectory,
  resolvePackageRelativePath,
  resolvePackageArtifactPath,
  isPathInside,
  ensurePackageLayout,
} from "@/lib/marketing/assets/paths";
export { sha256Buffer, sha256FileSync, byteSize, stableJsonBytes } from "@/lib/marketing/assets/hashing";
export { atomicWriteFile, atomicPublishFile } from "@/lib/marketing/assets/atomicWrite";
export { parseMediaBrief, parseMarketingAssetManifest } from "@/lib/marketing/assets/parse";
export { writePackageArtifact, writePackageArtifactFromFile, describePlannedArtifact, assertPackageArtifactWritable } from "@/lib/marketing/assets/writeArtifact";
export { buildMediaBriefFromCandidate } from "@/lib/marketing/assets/buildMediaBriefFromCandidate";
export {
  exportMarketingCandidatePackage,
  listImmediatePackageDirectories,
  type ExportMarketingCandidatePackageInput,
  type ExportMarketingCandidatePackageResult,
} from "@/lib/marketing/assets/exportMarketingCandidatePackage";
export {
  inspectMarketingAssetPackage,
  readMarketingAssetPackageFile,
  type MarketingAssetPackageInspectStatus,
  type MarketingAssetPackageInspection,
  type MarketingAssetPackageFileRead,
} from "@/lib/marketing/assets/inspectMarketingAssetPackage";
export { marketingAssetErrorResponse } from "@/lib/marketing/assets/assetApiErrors";
export {
  inspectCandidateAssetPackage,
  exportCandidateAssetPackage,
  readCandidateAssetPackageFile,
  loadCompletedMarketingCandidateForAssets,
} from "@/lib/marketing/assets/candidateAssetPackageService";
export {
  parseExportMarketingCandidateAssetsArgs,
  runExportMarketingCandidateAssetsCommand,
} from "@/lib/marketing/assets/exportCommand";
export {
  CARDNEWS_RENDER_CONTRACT,
  CARDNEWS_RENDERER_VERSION,
  CARDNEWS_WIDTH,
  CARDNEWS_HEIGHT,
  CARDNEWS_MEDIA_TYPE,
} from "@/lib/marketing/assets/cardnews/brand";
export { fitText, wrapText } from "@/lib/marketing/assets/cardnews/textLayout";
export { renderCardNewsPackage } from "@/lib/marketing/assets/cardnews/renderCardNewsPackage";
export { createCardNewsVerificationBrief, CARDNEWS_VERIFICATION_CANDIDATE_ID } from "@/lib/marketing/assets/cardnews/fixture";
export {
  parseRenderMarketingCardNewsArgs,
  runRenderMarketingCardNewsCommand,
} from "@/lib/marketing/assets/cardnews/cli";
export {
  AI_VIDEO_SHOT_LIST_CONTRACT,
  AI_VIDEO_ASPECT_RATIO,
  AI_VIDEO_TIMING_SOURCE,
  aiVideoShotListSchema,
  type AiVideoShot,
  type AiVideoShotList,
} from "@/lib/marketing/assets/video/contracts";
export {
  MEDIA_BRIEF_RELATIVE_PATH,
  AI_VIDEO_SHOT_LIST_RELATIVE_PATH,
  AI_VIDEO_PROMPT_PACK_RELATIVE_PATH,
  aiVideoShotPromptRelativePath,
} from "@/lib/marketing/assets/video/paths";
export { AI_VIDEO_NEGATIVE_CONSTRAINTS, composeAiVideoShotPrompt } from "@/lib/marketing/assets/video/prompts";
export { buildAiVideoShotList, matchNarrationToTimeline, parseAiVideoShotList, assertShotListMatchesTimeline } from "@/lib/marketing/assets/video/map";
export { persistAiVideoShotPack, planAiVideoShotArtifacts } from "@/lib/marketing/assets/video/persist";
export { generateAiVideoShotPack, readMediaBriefFromPackage } from "@/lib/marketing/assets/video/orchestrate";
export { createA8VerificationBrief, AI_VIDEO_VERIFICATION_CANDIDATE_ID } from "@/lib/marketing/assets/video/fixture";
export {
  parseGenerateMarketingVideoShotsArgs,
  runGenerateMarketingVideoShotsCommand,
} from "@/lib/marketing/assets/video/cli";
export {
  VIDEO_CLIP_INTAKE_CONTRACT,
  VIDEO_CLIP_INTAKE_RELATIVE_PATH,
  AI_VIDEO_INCOMING_DIRECTORY,
  videoClipIntakeSchema,
  type VideoClipIntake,
  type VideoClipIntakeClip,
} from "@/lib/marketing/assets/video/intake/contracts";
export {
  isPortraitNearNineSixteen,
  AI_VIDEO_ASPECT_RATIO_MAX_RELATIVE_ERROR_PERCENT,
} from "@/lib/marketing/assets/video/intake/aspect";
export {
  parseFfprobeVideoJson,
  createFfprobeIncomingVideoProbe,
  type IncomingVideoProbe,
  type IncomingVideoMetadata,
} from "@/lib/marketing/assets/video/intake/probe";
export {
  parseIncomingShotFileName,
  assertSafeIncomingFileName,
  resolveIncomingClipAbsolutePath,
} from "@/lib/marketing/assets/video/intake/incoming";
export { inspectVideoClipIntake, readAiVideoShotListFromPackage } from "@/lib/marketing/assets/video/intake/inspect";
export { intakeVideoClipsFromPackage } from "@/lib/marketing/assets/video/intake/orchestrate";
export {
  parseIntakeMarketingVideoClipsArgs,
  runIntakeMarketingVideoClipsCommand,
} from "@/lib/marketing/assets/video/intake/cli";
export {
  VIDEO_PREVIEW_COMPOSITION_CONTRACT,
  VIDEO_PREVIEW_RELATIVE_PATH,
  VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
  videoPreviewCompositionSchema,
  type VideoPreviewComposition,
} from "@/lib/marketing/assets/video/preview/contracts";
export {
  VIDEO_PREVIEW_PROFILE,
  VIDEO_PREVIEW_DURATION_QA_TOLERANCE_MS,
  VIDEO_PREVIEW_GAP_POLICY,
  VIDEO_PREVIEW_SUBTITLE_MODE,
  msToFfmpegSeconds,
} from "@/lib/marketing/assets/video/preview/profile";
export { buildPreviewFilterComplex, buildPreviewFfmpegArgs } from "@/lib/marketing/assets/video/preview/graph";
export { inspectVideoPreviewReadiness } from "@/lib/marketing/assets/video/preview/readiness";
export { composeVideoPreviewFromPackage, createFfmpegRunner } from "@/lib/marketing/assets/video/preview/orchestrate";
export {
  parseComposeMarketingVideoPreviewArgs,
  runComposeMarketingVideoPreviewCommand,
} from "@/lib/marketing/assets/video/preview/cli";

// SV-1 — shortform storage / retention / pressure policy (no delete executor)
export {
  SHORTFORM_STORAGE_POLICY_CONTRACT,
  SHORTFORM_RETENTION_POLICY_CONTRACT,
  SHORTFORM_RETENTION_POLICY_V1,
  SHORTFORM_PI_STORAGE_PRESSURE_THRESHOLDS_V1,
  SHORTFORM_WORKER_STORAGE_POLICY_V1,
  SHORTFORM_WORKER_WORKSPACE_DEFAULT_PATH,
  SHORTFORM_BULK_MEDIA_TMP_PROHIBITED,
  SHORTFORM_ASSET_ARCHITECTURE_V1,
  SHORTFORM_STORAGE_CLASSES,
  MARKETING_MEDIA_SOURCE_KINDS,
  SHORTFORM_ASSET_DISPOSITIONS,
  ShortformStoragePolicyError,
  defaultStorageClassForSource,
  defaultDispositionForSource,
  impliesPermanentLocalBinary,
  isAutoDeleteEligible,
  evaluateStoragePressure,
  evaluateShortformWorkerStorage,
  assertValidFilesystemCapacityStats,
  type ShortformStorageClass,
  type MarketingMediaSourceKind,
  type ShortformAssetDisposition,
  type StoragePressureLevel,
  type StoragePressureDecision,
  type FilesystemCapacityStats,
  type ShortformWorkerStorageStatus,
  type ShortformWorkerStorageDecision,
  type ShortformWorkerStorageStats,
  type AutoDeleteEligibilityInput,
  type AutoDeleteEligibility,
} from "@/lib/marketing/assets/shortform/storagePolicy";
export { readFilesystemCapacity } from "@/lib/marketing/assets/shortform/capacity";

// SV-2 — Global Source Catalog (identity/provenance/PICK; not a binary archive)
export {
  MARKETING_MEDIA_SOURCE_CATALOG_CONTRACT,
  MARKETING_MEDIA_SOURCE_STATUSES,
  MARKETING_MEDIA_RIGHTS_KINDS,
  MARKETING_MEDIA_TYPES,
  MARKETING_MEDIA_ORIENTATIONS,
  type MarketingMediaSourceStatus,
  type MarketingMediaRightsKind,
  type MarketingMediaType,
  type MarketingMediaOrientation,
  type MarketingMediaSourceRecord,
  type MarketingMediaSourceUsageRecord,
  type RegisterMarketingMediaSourceInput,
  type RegisterExternalMarketingMediaSourceInput,
  type UpdateMarketingMediaSourceInput,
  type RecordMarketingMediaSourcePickInput,
  type ListMarketingMediaSourcesFilter,
} from "@/lib/marketing/assets/sourceCatalog/types";
export { MarketingSourceCatalogError } from "@/lib/marketing/assets/sourceCatalog/errors";
export type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
export {
  createMarketingMediaSourceCatalogRepository,
  createInMemoryMarketingMediaSourceCatalogRepository,
  isMarketingMediaSourceCatalogRepositoryConfigured,
} from "@/lib/marketing/assets/sourceCatalog/createSourceCatalogRepository";
export { marketingMediaSourceToAutoDeleteInput } from "@/lib/marketing/assets/sourceCatalog/policyBridge";
export {
  validateRegisterMarketingMediaSourceInput,
  validateRegisterExternalMarketingMediaSourceInput,
  rightsKindImpliesCommercialClearance,
} from "@/lib/marketing/assets/sourceCatalog/validation";

// SV-3 — ShortVideoBrief (resolver input; does not replace MediaBrief / Shot List)
export {
  SHORT_VIDEO_BRIEF_CONTRACT,
  SHORT_VIDEO_BRIEF_ASPECT_RATIO,
  SHORT_VIDEO_DURATION_PRESETS,
  SHORT_VIDEO_DURATION_PRESET_MS,
  SHORT_VIDEO_DURATION_DEFAULT_PRESET,
  SHORT_VIDEO_MEDIA_PREFERENCES,
  type ShortVideoBrief,
  type ShortVideoSceneRequirement,
  type ShortVideoSceneVisual,
  type ShortVideoDurationPreset,
  type ShortVideoMediaPreference,
} from "@/lib/marketing/assets/shortVideoBrief/contracts";
export { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
export { buildShortVideoBrief, inferFactualVisualRequired } from "@/lib/marketing/assets/shortVideoBrief/buildShortVideoBrief";
export { parseShortVideoBrief, assertShortVideoBriefInvariants } from "@/lib/marketing/assets/shortVideoBrief/validate";
export {
  selectDurationPreset,
  nearestDurationPreset,
  durationPresetMs,
  splitDurationAcrossScenes,
} from "@/lib/marketing/assets/shortVideoBrief/duration";
export {
  isShortVideoBriefGenerationApplicable,
  productionRequestMentionsShortVideoConcept,
} from "@/lib/marketing/assets/shortVideoBrief/gating";
export {
  planShortVideoBriefArtifact,
  persistShortVideoBrief,
} from "@/lib/marketing/assets/shortVideoBrief/persist";

// SV-4 — Shortform Source Resolver (resolve ≠ pick ≠ ingest; search only)
export {
  SHORTFORM_SOURCE_RESOLUTION_CONTRACT,
  type ShortformSourceCandidate,
  type ShortformSceneSourceResolution,
  type ShortformSourceResolutionPlan,
  type ShortformSourceCandidateOrigin,
  type ShortformFactualMatch,
} from "@/lib/marketing/assets/shortform/resolver/contracts";
export {
  SHORTFORM_RESOLVER_PROVIDER_RAW_LIMIT,
  SHORTFORM_RESOLVER_FINAL_CANDIDATE_LIMIT,
  SHORTFORM_RESOLVER_AUTO_PICK_MIN_SCORE,
  SHORTFORM_RESOLVER_REVIEW_MIN_SCORE,
  SHORTFORM_PIXABAY_SEARCH_CACHE_TTL_MS,
} from "@/lib/marketing/assets/shortform/resolver/constants";
export { resolveSceneSources } from "@/lib/marketing/assets/shortform/resolver/resolveScene";
export { resolveShortVideoSources } from "@/lib/marketing/assets/shortform/resolver/resolveBrief";
export { createShortformResolverProviders } from "@/lib/marketing/assets/shortform/resolver/createProviders";
export { SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/resolver/paths";
export {
  planShortformSourceResolutionArtifact,
  persistShortformSourceResolution,
} from "@/lib/marketing/assets/shortform/resolver/persist";
export {
  createMemorySourceSearchCache,
  createFileSourceSearchCache,
} from "@/lib/marketing/assets/shortform/resolver/searchCache";
export type { ShortformSourceProvider } from "@/lib/marketing/assets/shortform/resolver/provider";

// SV-5 — Human Source Review / Explicit Pick (no binary ingest)
export {
  resolveShortformSourcesForReview,
  pickShortformSourceForReview,
  ShortformSourceReviewError,
} from "@/lib/marketing/assets/shortform/review/service";
export type { ShortformSourcesResolveDto } from "@/lib/marketing/assets/shortform/review/dto";

// SV-6 — Durable Shortform VideoRenderJob (orchestration only; no worker/media execution)
export {
  SHORTFORM_VIDEO_RENDER_JOB_CONTRACT,
  SHORTFORM_VIDEO_RENDER_PROFILE_V1,
  SHORTFORM_VIDEO_RENDER_JOB_STATUSES,
  DEFAULT_SHORTFORM_VIDEO_RENDER_MAX_ATTEMPTS,
  DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS,
  type ShortformVideoRenderJob,
  type ShortformVideoRenderJobStatus,
  type ShortformVideoRenderInputSnapshot,
} from "@/lib/marketing/assets/shortform/renderJob/contracts";
export {
  validateShortformRenderEnqueueInput,
  assertShortformRenderEnqueueInput,
} from "@/lib/marketing/assets/shortform/renderJob/validateEnqueue";
export {
  enqueueShortformVideoRenderJob,
  createInMemoryShortformVideoRenderJobRepository,
  ownershipFromShortformRenderClaim,
} from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
export {
  createShortformVideoRenderJobRepository,
  isShortformVideoRenderJobRepositoryConfigured,
} from "@/lib/marketing/assets/shortform/renderJob/createRepository";
export type { ShortformVideoRenderJobRepository } from "@/lib/marketing/assets/shortform/renderJob/repository";
export { ShortformVideoRenderJobError } from "@/lib/marketing/assets/shortform/renderJob/errors";
export {
  isEphemeralCleanupEligibleAfterReady,
  SHORTFORM_RENDER_CLEANUP_ORDERING_STEPS,
} from "@/lib/marketing/assets/shortform/renderJob/cleanupOrdering";

// SV-7 — Mini-PC shortform worker runtime (no media execution)
export {
  loadShortformVideoWorkerConfig,
  defaultShortformWorkerId,
  DEFAULT_SHORTFORM_WORKER_MAX_JOBS_PER_RUN,
  SHORTFORM_WORKER_CONCURRENCY,
  SHORTFORM_WORKER_LEASE_RENEWAL_SUPPORTED,
} from "@/lib/marketing/assets/shortform/worker/config";
export {
  processShortformVideoRenderQueue,
  type ShortformWorkerRunResult,
} from "@/lib/marketing/assets/shortform/worker/processQueue";
export {
  createDefaultShortformVideoRenderExecutor,
  DisabledShortformVideoRenderExecutor,
  UnreadyProductionShortformVideoRenderExecutor,
  type ShortformVideoRenderExecutor,
} from "@/lib/marketing/assets/shortform/worker/executor";
export { FakeShortformVideoRenderExecutor } from "@/lib/marketing/assets/shortform/worker/fakeExecutor";
export {
  resolveShortformWorkspaceRoot,
  assertSafeShortformJobId,
  createShortformJobWorkspace,
} from "@/lib/marketing/assets/shortform/worker/workspace";
export { buildShortformWorkerHealthReport } from "@/lib/marketing/assets/shortform/worker/health";

// SV-8A — Production shortform media executor (code only; Mini-PC deploy = SV-8B)
export {
  ProductionShortformVideoRenderExecutor,
  createTestProductionShortformVideoRenderExecutor,
} from "@/lib/marketing/assets/shortform/production/productionExecutor";
export {
  probeShortformProductionReadiness,
  type ShortformProductionReadiness,
} from "@/lib/marketing/assets/shortform/production/readiness";
export {
  SHORTFORM_FINAL_RELATIVE_PATH,
  SHORTFORM_OUTPUT_PROFILE_V1,
} from "@/lib/marketing/assets/shortform/production/paths";
export { createShortformSourceMaterializerRouter } from "@/lib/marketing/assets/shortform/production/materialize";

// SV-8B2 — Private marketing asset transport (Pi Asset Transfer API)
export {
  MARKETING_ASSET_TRANSPORT_MODE_ENV,
  MARKETING_ASSET_TRANSFER_TOKEN_ENV,
  MARKETING_ASSET_TRANSFER_BASE_URL_ENV,
  MARKETING_ASSET_TRANSFER_BIND_HOST_ENV,
  MARKETING_ASSET_TRANSFER_PORT_ENV,
  MARKETING_ASSET_TRANSFER_LIMITS,
  SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH,
  CANDIDATE_PACKAGE_ARTIFACT_KINDS,
  parseMarketingAssetTransportMode,
  type MarketingAssetTransport,
  type MarketingAssetTransportMode,
  type CandidatePackageArtifactKind,
} from "@/lib/marketing/assets/transport/contracts";
export { createMarketingAssetTransport } from "@/lib/marketing/assets/transport/createTransport";
export { createLocalMarketingAssetTransport } from "@/lib/marketing/assets/transport/localTransport";
export { createHttpMarketingAssetTransport } from "@/lib/marketing/assets/transport/httpTransport";
