export const SELECTED_AGENDA_CONTRACT = "selected-agenda-v1" as const;
export const CONTENT_ASSIGNMENT_CONTRACT = "content-assignment-v1" as const;
export const CONTENT_PLAN_CONTRACT = "content-plan-v1" as const;

export type CommercialIntent = "informational" | "commercial" | "mixed";

export type AssignmentEvidenceRef = {
  evidenceId: string;
  sourceId: string;
  sourceType: string | null;
  sourceName: string | null;
  isOfficial: boolean;
  evidenceType: string;
  url: string | null;
  reference: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  observedAt: string;
  credibilityHint: number | null;
};

export type AssignmentFact = {
  factId: string;
  statement: string;
  evidenceRefs: string[];
  confidence: "high" | "medium" | "low";
};

export type ContentFormatKind =
  | "threads_text"
  | "instagram_carousel"
  | "blog_article"
  | "short_video_concept";

export type ContentFormatRecommendation = {
  format: ContentFormatKind;
  score: number;
  rationale: string;
};

export type SelectedAgendaProvenance = {
  decidedBy: "marketing-manager";
  managerDecisionSource: "explicit" | "research_assisted";
  researchScoreAtSelection: number | null;
  agendaCandidateId: string | null;
  researchBriefId: string | null;
};

export type SelectedAgenda = {
  contract: typeof SELECTED_AGENDA_CONTRACT;
  id: string;
  decidedAt: string;
  title: string;
  summary: string;
  rationale: string[];
  destinations: string[];
  topics: string[];
  entities: string[];
  contentObjective: string;
  audienceHint: string | null;
  commercialIntent: CommercialIntent;
  matchedProductIds: string[];
  evidenceRefs: AssignmentEvidenceRef[];
  constraints: string[];
  urgency: "low" | "normal" | "high";
  timelinessNote: string | null;
  provenance: SelectedAgendaProvenance;
};

export type ContentAssignmentProvenance = {
  selectedAgendaId: string;
  createdBy: "marketing-manager-handoff";
  idempotencyKey: string;
};

export type ContentAssignment = {
  contract: typeof CONTENT_ASSIGNMENT_CONTRACT;
  assignmentId: string;
  createdAt: string;
  selectedAgendaId: string;
  selectedAgendaTitle: string;
  objective: string;
  topic: string;
  audience: string | null;
  destinations: string[];
  facts: AssignmentFact[];
  commercialIntent: CommercialIntent;
  matchedProductIds: string[];
  constraints: string[];
  formatHints: ContentFormatRecommendation[];
  requiredOutputs: Array<"content_plan" | "text_draft">;
  deadline: string | null;
  evidenceRefs: AssignmentEvidenceRef[];
  riskNotes: string[];
  provenance: ContentAssignmentProvenance;
};

export type ContentPlan = {
  contract: typeof CONTENT_PLAN_CONTRACT;
  assignmentId: string;
  recommendedFormats: ContentFormatRecommendation[];
  primaryAngle: string;
  keyMessage: string;
  targetAudience: string;
  hook: string;
  outline: string[];
  factsToUse: string[];
  factsToAvoid: string[];
  ctaStrategy: string;
  productLinkageStrategy: string;
  evidenceRefs: AssignmentEvidenceRef[];
  requiredAssets: string[];
  riskNotes: string[];
  draftInstructions: string[];
};

export type CreateSelectedAgendaInput = {
  title: string;
  summary: string;
  rationale?: string[];
  researchBriefId?: string | null;
  agendaCandidateId?: string | null;
  destinations?: string[];
  topics?: string[];
  entities?: string[];
  contentObjective?: string;
  audienceHint?: string | null;
  commercialIntent?: CommercialIntent;
  matchedProductIds?: string[];
  evidenceRefs?: AssignmentEvidenceRef[];
  constraints?: string[];
  urgency?: SelectedAgenda["urgency"];
  timelinessNote?: string | null;
  researchScoreAtSelection?: number | null;
  managerDecisionSource?: SelectedAgendaProvenance["managerDecisionSource"];
  idempotencyKey?: string;
  now?: Date;
};

export type CreateContentAssignmentInput = {
  selectedAgenda: SelectedAgenda;
  channel?: string;
  idempotencyKey?: string;
  now?: Date;
};

export type ManagerToContentHandoffResult = {
  selectedAgenda: SelectedAgenda;
  contentAssignment: ContentAssignment;
  contentPlanScaffold: ContentPlan;
};

export type GetContentAssignmentResult =
  | { status: "ok"; assignment: ContentAssignment; selectedAgenda: SelectedAgenda | null }
  | { status: "not_found"; assignmentId: string };

export type GetAssignmentResearchEvidenceResult =
  | { status: "ok"; assignmentId: string; evidenceRefs: AssignmentEvidenceRef[]; facts: AssignmentFact[] }
  | { status: "not_found"; assignmentId: string };
