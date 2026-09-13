export {
  MARKETING_VALUE_ASSESSMENT_CONTRACT,
  MARKETING_VALUE_BUNDLE_CONTRACT,
  MARKETING_VALUE_EVALUATOR_VERSION,
  MARKETING_VALUE_VERDICTS,
  clampScore,
  verdictFromScore,
  isMarketingValueApprovable,
  toMarketingValueCompact,
  type MarketingValueAssessment,
  type MarketingValueBundle,
  type MarketingValueVerdict,
  type MarketingValueCompact,
} from "@/lib/marketing/value/contracts";
export { parseMarketingValueAssessment, parseMarketingValueBundle } from "@/lib/marketing/value/parse";
export {
  evaluateMarketingValue,
  evaluateBundleChannels,
} from "@/lib/marketing/value/evaluateMarketingValue";
export {
  buildMarketingValueBundle,
  persistMarketingValueBundle,
  tryReadMarketingValueBundle,
  attachAssessmentsToPublishableBundle,
  markMarketingValueStale,
} from "@/lib/marketing/value/persist";
export { MARKETING_VALUE_RELATIVE_PATH } from "@/lib/marketing/value/paths";
