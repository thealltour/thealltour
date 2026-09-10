export type {
  AssignmentEvidenceRef,
  AssignmentFact,
  CommercialIntent,
  ContentAssignment,
  ContentAssignmentProvenance,
  ContentDeliverableRequirements,
  ContentFormatKind,
  ContentFormatRecommendation,
  ContentPlan,
  CreateContentAssignmentInput,
  CreateSelectedAgendaInput,
  EvidencePack,
  EvidencePackItem,
  GetAssignmentResearchEvidenceResult,
  GetContentAssignmentResult,
  ManagerToContentHandoffResult,
  SelectedAgenda,
  SelectedAgendaProvenance,
} from "@/lib/marketing/content/types";
export {
  CONTENT_ASSIGNMENT_CONTRACT,
  CONTENT_DELIVERABLE_REQUIREMENTS_CONTRACT,
  CONTENT_PLAN_CONTRACT,
  EVIDENCE_PACK_CONTRACT,
  SELECTED_AGENDA_CONTRACT,
} from "@/lib/marketing/content/types";
export { createSelectedAgenda, buildSelectedAgendaIdempotencyKey, DEFAULT_INFORMATIONAL_TRAVEL_AUDIENCE } from "@/lib/marketing/content/createSelectedAgenda";
export { createContentAssignment, buildContentAssignmentIdempotencyKey } from "@/lib/marketing/content/createContentAssignment";
export { buildContentPlanScaffold } from "@/lib/marketing/content/buildContentPlanScaffold";
export {
  buildDeliverableRequirements,
  isCompletenessContractEnabled,
  isCompletenessValidatorEnabled,
  isEvidencePackEnabled,
} from "@/lib/marketing/content/buildDeliverableRequirements";
export {
  buildEvidencePack,
  allowedEvidenceIdsFromPack,
  packHasAllowedFactualItems,
} from "@/lib/marketing/content/evidencePack";
export {
  validateContentCompleteness,
  projectSourceReferences,
} from "@/lib/marketing/content/completenessValidator";
export { recommendContentFormats } from "@/lib/marketing/content/recommendContentFormats";
export { mapManagerEvidenceRef, buildAssignmentFacts, normalizeFactStatement, weakEvidenceRiskNotes } from "@/lib/marketing/content/evidence";
export { buildStablePrefixedId } from "@/lib/marketing/content/stablePrefixedId";
export {
  prepareManagerToContentHandoff,
  enrichSelectedAgendaInputFromResearch,
} from "@/lib/marketing/content/prepareManagerToContentHandoff";
export {
  createInMemoryContentAssignmentStore,
  getDefaultContentAssignmentStore,
  resetDefaultContentAssignmentStore,
  getContentAssignmentById,
  getAssignmentResearchEvidence,
} from "@/lib/marketing/content/store/contentAssignmentStore";
export * from "@/lib/marketing/content/governance";
