export {
  ASSET_SOURCE_WRITER_ROLE,
  CANONICAL_MARKETING_ASSET_CONTRACT,
  CANONICAL_ASSET_STATUSES,
  PRODUCTION_OUTCOME_AWAITING_ASSET_APPROVAL,
  CANDIDATE_CANONICAL_ASSET_KEY,
  PRODUCTION_REQUEST_CANONICAL_ASSET_KEY,
  PRODUCTION_REQUEST_RESUME_CHANNELS_KEY,
  type CanonicalMarketingAsset,
  type CanonicalAssetStatus,
  type CanonicalAssetWriterInput,
} from "@/lib/marketing/canonicalAsset/contracts";
export {
  validateCanonicalMarketingAsset,
  isApprovedCanonicalAsset,
} from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
export {
  ensureCanonicalMarketingAsset,
  CANONICAL_ASSET_MAX_REPAIRS,
  type EnsureCanonicalMarketingAssetResult,
  type AssetSourceWriterInvoke,
} from "@/lib/marketing/canonicalAsset/ensureCanonicalMarketingAsset";
export {
  applyHumanCanonicalAssetEdit,
  approveCanonicalMarketingAsset,
  canFeedChannelsFromCanonicalAsset,
  markCanonicalAssetStale,
  rejectCanonicalAsset,
} from "@/lib/marketing/canonicalAsset/humanAssetApproval";
export {
  approveCanonicalAssetAndGenerateChannels,
  saveCanonicalAssetHumanEdit,
} from "@/lib/marketing/canonicalAsset/approveAndGenerateChannels";
export {
  resolveCanonicalMarketingAsset,
  persistCanonicalAssetToPackage,
  attachCanonicalAssetToCandidate,
  readCanonicalAssetFromPackage,
  readCanonicalAssetFromCandidate,
  readCanonicalAssetFromProductionRequest,
  isAwaitingAssetApproval,
  productionRequestMetadataWithCanonicalAsset,
} from "@/lib/marketing/canonicalAsset/persistence";
export {
  buildCanonicalAssetWriterInput,
  computeCanonicalAssetSourceRevision,
  computeEvidenceRevision,
  computePropositionRevision,
} from "@/lib/marketing/canonicalAsset/revisions";
export { parseDurableCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/parseCanonicalMarketingAsset";
export {
  CANONICAL_MARKETING_ASSET_RELATIVE_PATH,
  CANONICAL_MARKETING_ASSET_MEDIA_TYPE,
} from "@/lib/marketing/canonicalAsset/paths";
export { buildAssetSourceWriterPrompt } from "@/lib/marketing/canonicalAsset/prompt";
export {
  CANONICAL_ASSET_CHATGPT_EDIT_CONTRACT,
  STALE_ASSET_MESSAGE_KO,
  buildCanonicalAssetChatGptClipboardText,
  buildCanonicalAssetChatGptExportPayload,
  buildKeyEvidenceKo,
  normalizeKeyTakeawaysKo,
  parseCanonicalAssetChatGptImport,
  validateCanonicalAssetChatGptEdits,
  formatCanonicalAssetValidationIssuesKo,
} from "@/lib/marketing/canonicalAsset/chatGptAssetTransfer";
export type {
  CanonicalAssetChatGptEditable,
  CanonicalAssetChatGptContextReadOnly,
  CanonicalAssetChatGptExportPayload,
  CanonicalAssetChatGptImportFail,
  CanonicalAssetChatGptImportOk,
  CanonicalAssetChatGptImportPreview,
} from "@/lib/marketing/canonicalAsset/chatGptAssetTransfer";
export {
  resolveCanonicalAssetDomainContext,
  canValidateCanonicalAssetAgainstDomain,
} from "@/lib/marketing/canonicalAsset/resolveCanonicalAssetDomainContext";
