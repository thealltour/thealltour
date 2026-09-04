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
