export * from "@/lib/marketing/publishable/channelSources/contracts";
export {
  CHANNEL_SIDECAR_RELATIVE_PATHS,
  CHANNEL_SOURCE_SELECTION_RELATIVE_PATH,
  EXTERNAL_EDITORIAL_CANDIDATES_DIRECTORY,
  HERMES_AUTO_SNAPSHOTS_DIRECTORY,
  externalEditorialCandidateRelativePath,
  hermesAutoSnapshotRelativePath,
  isValidExternalImportId,
} from "@/lib/marketing/publishable/channelSources/paths";
export {
  parseExternalEditorialResult,
  type ExternalEditorialParseErrorCode,
  type ParseExternalEditorialResult,
  type ParsedExternalEditorialResult,
} from "@/lib/marketing/publishable/channelSources/parseExternalEditorialResult";
export {
  ExternalChannelMaterializeError,
  materializeExternalChannel,
  type ExternalChannelMaterialization,
  type ExternalMaterializeContext,
} from "@/lib/marketing/publishable/channelSources/materializeExternalChannel";
export {
  ExternalEditorialCandidateExistsError,
  listExternalEditorialCandidates,
  readExternalEditorialCandidate,
} from "@/lib/marketing/publishable/channelSources/externalCandidateStore";
export { importExternalEditorialResult } from "@/lib/marketing/publishable/channelSources/importExternalEditorial";
export {
  INSTAGRAM_CARDNEWS_IMPORT_MESSAGES_KO,
  importInstagramCardnewsResult,
  resolveExternalInstagramCoverTitleSuggestion,
  type ImportInstagramCardnewsResult,
  type InstagramCardnewsImportErrorCode,
} from "@/lib/marketing/publishable/channelSources/importInstagramCardnews";
export {
  applyExternalCandidateToAllChannels,
  listChannelSourceViews,
  selectChannelSource,
  type ApplyExternalCandidateResult,
  syncReviewChannelAiDraft,
  type SelectChannelSourceInput,
  type SelectChannelSourceResult,
} from "@/lib/marketing/publishable/channelSources/selectChannelSource";
export {
  classifySlotSource,
  readChannelSourceSelection,
  reconcileChannelSourceSelection,
  resolveChannelSourceView,
} from "@/lib/marketing/publishable/channelSources/selection";
export { resolveInstagramNarrativeForVisualPlanning } from "@/lib/marketing/publishable/channelSources/visualNarrative";
