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
export { sha256Buffer, byteSize, stableJsonBytes } from "@/lib/marketing/assets/hashing";
export { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
export { parseMediaBrief, parseMarketingAssetManifest } from "@/lib/marketing/assets/parse";
export { writePackageArtifact, describePlannedArtifact, assertPackageArtifactWritable } from "@/lib/marketing/assets/writeArtifact";
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
