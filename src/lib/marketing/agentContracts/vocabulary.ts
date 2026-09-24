/**
 * Domain vocabulary keys used by semantic contracts (Phase 3A).
 * These are distinct meaning spaces — do NOT merge into one mega-enum.
 */

export const MARKETING_AGENT_VOCABULARY_KEYS = [
  "canonical.factualBoundary",
  "editorialNarrative.storySequence",
  "editorialNarrative.readerPromise",
  "instagram.carouselStructure",
  "instagram.carousel.editorialRole",
  "instagram.cardCopy",
  "instagram.caption",
  "instagram.visualSemantics",
  "instagram.visual.visualRole",
  "instagram.presentation",
  "presentation.template",
  "sharedVisual.masterOrchestration",
  "sharedVisual.role",
  "astra.generationBrief",
  "publishable.bundle",
  "threads.copy",
  "naverBlog.structure",
  "naverBlog.copy",
  "naverBand.copy",
  "legacy.visualHints",
  // Department domain keys (Phase 3E) — do not reuse specialist keys
  "contentStrategy.proposition",
  "contentStrategy.contentPlan",
  "contentStrategy.draftScaffold",
  "marketingManagement.orchestration",
  "marketingManagement.agendaSelection",
  "marketingManagement.assignmentHandoff",
  "governance.assessment",
  "governance.verdict",
  "performance.analysis",
  "performance.recommendation",
  "research.audienceContentBrief",
  "content.assignment",
  "content.evidencePack",
  "content.selectedAgenda",
] as const;

export type MarketingAgentVocabularyKey = (typeof MARKETING_AGENT_VOCABULARY_KEYS)[number];

export const MARKETING_AGENT_VOCABULARY_SET = new Set<string>(MARKETING_AGENT_VOCABULARY_KEYS);

/**
 * Explicitly separate role vocabularies (VRA incident: carousel role ≠ visualRole).
 */
export const MARKETING_ROLE_VOCABULARY_SEPARATION = {
  carouselEditorialRole: {
    key: "instagram.carousel.editorialRole" as const,
    meaning: "Editorial card role in carousel structure (hook_cover, reframe, context, …)",
    notEqualTo: ["instagram.visual.visualRole", "sharedVisual.role"],
  },
  visualRole: {
    key: "instagram.visual.visualRole" as const,
    meaning: "Per-card visual semantics owned by VRA (hero_cover, evidence_detail, …)",
    notEqualTo: ["instagram.carousel.editorialRole", "sharedVisual.role"],
  },
  sharedVisualRole: {
    key: "sharedVisual.role" as const,
    meaning: "Master visual role label on Shared Visual Plan masters (orchestration)",
    notEqualTo: ["instagram.carousel.editorialRole", "instagram.visual.visualRole"],
  },
  presentationTemplate: {
    key: "presentation.template" as const,
    meaning: "Layout template / crop / overlay owned by Card Layout Director",
    notEqualTo: ["instagram.visual.visualRole"],
  },
} as const;
