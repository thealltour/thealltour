export {
  ContentPlanContractError,
  type ContentPlanValidationIssue,
  type ContentPlanValidationSource,
} from "@/lib/marketing/content/validation/contentPlanContractError";
export {
  assignmentEvidenceRefSchema,
  contentFormatRecommendationSchema,
  contentPlanCanonicalSchema,
  contentPlanProviderSchema,
  CONTENT_PLAN_MAX_EVIDENCE,
  CONTENT_PLAN_MAX_FACTS,
} from "@/lib/marketing/content/validation/contentPlanSchema";
export {
  canSafelyAdaptLegacyEvidenceRefs,
  getProviderEvidencePresence,
  hasFactualClaimsFromPlan,
  parseProviderContentPlan,
  planHasFactualClaims,
  resolveEvidenceForGovernance,
  resolveContentPlanForGovernance,
  validateInternalContentPlan,
  type ContentPlanValidationSource as ContentPlanResolveSource,
  type ProviderEvidencePresence,
} from "@/lib/marketing/content/validation/validateContentPlan";
