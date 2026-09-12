export {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  PUBLISHABLE_CHANNELS,
  PUBLISHABLE_OPTIONAL_CHANNELS,
  type PublishableChannel,
  type PublishableChannelContent,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
export { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
export {
  buildPublishableComposerInput,
  computePublishableSourceRevision,
  buildResearchContextFromAcrb,
} from "@/lib/marketing/publishable/inputs";
export {
  looksLikeInternalPlanningBody,
  validatePublishableText,
  stripEvidenceIdsFromText,
  assertChannelNativeStructure,
} from "@/lib/marketing/publishable/validate";
export {
  resolveTargetPublishableChannels,
  recommendTargetChannelsFromAcrb,
} from "@/lib/marketing/publishable/selectTargetChannels";
export { composeThreadsPublishableContent } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
export { composeShortformNarration } from "@/lib/marketing/publishable/shortform/composeShortformNarration";
export { composeNaverBlogPublishableContent } from "@/lib/marketing/publishable/naver_blog/composeNaverBlogPublishableContent";
export { composeNaverBandPublishableContent } from "@/lib/marketing/publishable/naver_band/composeNaverBandPublishableContent";
export { composeKakaoChannelPublishableContent } from "@/lib/marketing/publishable/kakao_channel/composeKakaoChannelPublishableContent";
export { ensurePublishableContent } from "@/lib/marketing/publishable/ensurePublishableContent";
export { ensurePublishableContentSync } from "@/lib/marketing/publishable/ensurePublishableContentSync";
export { persistPublishableContentBundle } from "@/lib/marketing/publishable/persist";
export {
  applyPublishableContentToMediaBrief,
  buildThreadsPostText,
} from "@/lib/marketing/publishable/applyToMediaBrief";
