export type {
  AssignmentEvidenceRef,
  AssignmentFact,
  CommercialIntent,
  ContentAssignment,
  ContentAssignmentProvenance,
  ContentFormatKind,
  ContentFormatRecommendation,
  ContentPlan,
  CreateContentAssignmentInput,
  CreateSelectedAgendaInput,
  GetAssignmentResearchEvidenceResult,
  GetContentAssignmentResult,
  ManagerToContentHandoffResult,
  SelectedAgenda,
  SelectedAgendaProvenance,
} from "@/lib/marketing/content/types";
export {
  CONTENT_ASSIGNMENT_CONTRACT,
  CONTENT_PLAN_CONTRACT,
  SELECTED_AGENDA_CONTRACT,
} from "@/lib/marketing/content/types";
export { createSelectedAgenda, buildSelectedAgendaIdempotencyKey } from "@/lib/marketing/content/createSelectedAgenda";
export { createContentAssignment, buildContentAssignmentIdempotencyKey } from "@/lib/marketing/content/createContentAssignment";
export { buildContentPlanScaffold } from "@/lib/marketing/content/buildContentPlanScaffold";
export { recommendContentFormats } from "@/lib/marketing/content/recommendContentFormats";
export { mapManagerEvidenceRef, buildAssignmentFacts, weakEvidenceRiskNotes } from "@/lib/marketing/content/evidence";
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
