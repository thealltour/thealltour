/**
 * Marketing Agent Semantic Registry (Phase 3A).
 * Migrated agents: editorial + visual chain (+ optional channel copy metadata).
 */

import type { MarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticContract";
import {
  EDITORIAL_NARRATIVE_PLAN_CONTRACT,
} from "@/lib/marketing/publishable/editorialNarrative/contracts";
import {
  INSTAGRAM_CAPTION_CONTRACT,
  INSTAGRAM_CARD_COPY_CONTRACT,
  INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import { INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT } from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import { SHARED_VISUAL_PLAN_CONTRACT } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import { CARD_PRESENTATION_PLAN_CONTRACT } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import { MANUAL_ASTRA_HANDOFF_CONTRACT } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import { THREADS_COPY_CONTRACT } from "@/lib/marketing/publishable/threadsCopy/contracts";
import {
  NAVER_BLOG_COPY_CONTRACT,
  NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { NAVER_BAND_COPY_CONTRACT } from "@/lib/marketing/publishable/naverBandCopy/contracts";

export const MARKETING_AGENT_SEMANTIC_REGISTRY: readonly MarketingAgentSemanticContract[] = [
  {
    profileId: "editorial-narrative-planner",
    authority: {
      owns: [
        "editorialNarrative.storySequence",
        "editorialNarrative.readerPromise",
      ],
      reads: ["canonical.factualBoundary"],
      advisory: [],
      mustNotOwn: [
        "instagram.carouselStructure",
        "instagram.cardCopy",
        "instagram.caption",
        "instagram.visualSemantics",
        "sharedVisual.masterOrchestration",
      ],
    },
    inputs: { required: ["canonical.factualBoundary"] },
    output: { artifactId: EDITORIAL_NARRATIVE_PLAN_CONTRACT },
  },
  {
    profileId: "instagram-carousel-planner",
    authority: {
      owns: [
        "instagram.carouselStructure",
        "instagram.carousel.editorialRole",
      ],
      reads: ["editorialNarrative.storySequence", "editorialNarrative.readerPromise"],
      advisory: [],
      mustNotOwn: [
        "instagram.cardCopy",
        "instagram.visual.visualRole",
        "instagram.visualSemantics",
        "sharedVisual.masterOrchestration",
        "presentation.template",
      ],
    },
    inputs: {
      required: ["editorialNarrative.storySequence"],
    },
    output: { artifactId: INSTAGRAM_CAROUSEL_PLAN_CONTRACT },
    docs: {
      notes: [
        "OWNS: card count/order, editorial role, communicationGoal, beatIds, visualPriority.",
        "MUST NOT: final card copy, VRA visualRole, generatedVisualNeeded, visualMode, visualId, template, master grouping.",
        "Carousel editorialRole ≠ VRA visualRole.",
      ],
    },
  },
  {
    profileId: "instagram-card-copy-writer",
    authority: {
      owns: ["instagram.cardCopy"],
      reads: [
        "instagram.carouselStructure",
        "editorialNarrative.storySequence",
        "canonical.factualBoundary",
      ],
      advisory: [],
      mustNotOwn: [
        "instagram.carouselStructure",
        "instagram.visualSemantics",
        "sharedVisual.masterOrchestration",
      ],
    },
    inputs: {
      required: ["instagram.carouselStructure", "editorialNarrative.storySequence"],
      optional: ["canonical.factualBoundary"],
    },
    output: { artifactId: INSTAGRAM_CARD_COPY_CONTRACT },
    docs: {
      notes: ["OWNS headline/body only; MUST NOT redesign cardId/order or visual semantics."],
    },
  },
  {
    profileId: "instagram-caption-writer",
    authority: {
      owns: ["instagram.caption"],
      reads: [
        "canonical.factualBoundary",
        "editorialNarrative.storySequence",
        "instagram.carouselStructure",
        "instagram.cardCopy",
      ],
      advisory: [],
      mustNotOwn: [
        "instagram.carouselStructure",
        "instagram.visualSemantics",
        "sharedVisual.masterOrchestration",
      ],
    },
    inputs: {
      required: ["instagram.cardCopy"],
      optional: ["canonical.factualBoundary", "editorialNarrative.storySequence"],
    },
    output: { artifactId: INSTAGRAM_CAPTION_CONTRACT },
  },
  {
    profileId: "instagram-visual-role-architect",
    authority: {
      owns: ["instagram.visualSemantics", "instagram.visual.visualRole"],
      reads: [
        "canonical.factualBoundary",
        "editorialNarrative.storySequence",
        "instagram.carouselStructure",
        "instagram.cardCopy",
      ],
      advisory: [],
      mustNotOwn: [
        "sharedVisual.masterOrchestration",
        "sharedVisual.role",
        "presentation.template",
        "astra.generationBrief",
        "instagram.carousel.editorialRole",
      ],
    },
    inputs: {
      required: [
        "instagram.carouselStructure",
        "instagram.cardCopy",
        "editorialNarrative.storySequence",
      ],
      optional: ["canonical.factualBoundary"],
    },
    output: { artifactId: INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT },
    docs: {
      notes: [
        "OWNS per-card visualRole/purpose/density/generation/presentation prefs + concreteVisualIntent + rhythm.",
        "MUST NOT: master visualId/count/usages, final grouping, final generatedVisualNeeded/visualMode, layout template, Astra composition.",
        "visualRole vocabulary is separate from carousel editorialRole.",
      ],
    },
  },
  {
    profileId: "shared-visual-planner",
    authority: {
      owns: ["sharedVisual.masterOrchestration", "sharedVisual.role"],
      reads: ["publishable.bundle", "instagram.visualSemantics"],
      advisory: ["legacy.visualHints"],
      mustNotOwn: [
        "instagram.visual.visualRole",
        "instagram.visualSemantics",
        "presentation.template",
        "astra.generationBrief",
      ],
    },
    inputs: {
      required: ["publishable.bundle", "instagram.visualSemantics"],
      optional: ["legacy.visualHints"],
    },
    output: { artifactId: SHARED_VISUAL_PLAN_CONTRACT },
    docs: {
      notes: [
        "When VRA present and conflicts with legacy hints → VRA wins.",
        "MUST NOT redefine VRA card meaning; MUST NOT own layout geometry or Astra composition.",
      ],
    },
  },
  {
    profileId: "card-layout-director",
    authority: {
      owns: ["instagram.presentation", "presentation.template"],
      reads: ["instagram.cardCopy", "sharedVisual.masterOrchestration"],
      advisory: ["instagram.visualSemantics"],
      mustNotOwn: [
        "instagram.cardCopy",
        "sharedVisual.masterOrchestration",
        "astra.generationBrief",
      ],
    },
    inputs: {
      required: ["instagram.cardCopy"],
      optional: ["sharedVisual.masterOrchestration", "instagram.visualSemantics"],
    },
    output: { artifactId: CARD_PRESENTATION_PLAN_CONTRACT },
    docs: {
      notes: [
        "Production rendering is deterministic — Hermes Layout is not wired (Phase 3A).",
        "VRA presentationPreference is advisory only.",
      ],
    },
  },
  {
    profileId: "astra-handoff-writer",
    authority: {
      owns: ["astra.generationBrief"],
      reads: ["sharedVisual.masterOrchestration"],
      advisory: [],
      mustNotOwn: [
        "sharedVisual.masterOrchestration",
        "sharedVisual.role",
        "instagram.visualSemantics",
      ],
    },
    inputs: { required: ["sharedVisual.masterOrchestration"] },
    output: { artifactId: MANUAL_ASTRA_HANDOFF_CONTRACT },
    docs: {
      notes: [
        "OWNS brief enrichment only; MUST NOT mutate visualId/usages/generatedVisualNeeded/master grouping.",
      ],
    },
  },
  // Channel copy — metadata registration (behavior migration later)
  {
    profileId: "threads-copy-writer",
    authority: {
      owns: ["threads.copy"],
      reads: ["editorialNarrative.storySequence", "canonical.factualBoundary"],
      advisory: [],
      mustNotOwn: [
        "instagram.carouselStructure",
        "instagram.visualSemantics",
        "sharedVisual.masterOrchestration",
      ],
    },
    inputs: {
      required: ["editorialNarrative.storySequence"],
      optional: ["canonical.factualBoundary"],
    },
    output: { artifactId: THREADS_COPY_CONTRACT },
    docs: { notes: ["Phase 3A metadata only — channel copy behavior unchanged."] },
  },
  {
    profileId: "naver-blog-structure-planner",
    authority: {
      owns: ["naverBlog.structure"],
      reads: ["editorialNarrative.storySequence", "canonical.factualBoundary"],
      advisory: [],
      mustNotOwn: ["naverBlog.copy", "instagram.visualSemantics"],
    },
    inputs: {
      required: ["editorialNarrative.storySequence"],
      optional: ["canonical.factualBoundary"],
    },
    output: { artifactId: NAVER_BLOG_STRUCTURE_PLAN_CONTRACT },
    docs: { notes: ["Phase 3A metadata only."] },
  },
  {
    profileId: "naver-blog-copy-writer",
    authority: {
      owns: ["naverBlog.copy"],
      reads: ["naverBlog.structure", "editorialNarrative.storySequence", "canonical.factualBoundary"],
      advisory: [],
      mustNotOwn: ["naverBlog.structure", "instagram.visualSemantics"],
    },
    inputs: {
      required: ["naverBlog.structure"],
      optional: ["editorialNarrative.storySequence", "canonical.factualBoundary"],
    },
    output: { artifactId: NAVER_BLOG_COPY_CONTRACT },
    docs: { notes: ["Phase 3D: lifecycle wired; Structure order authority preserved."] },
  },
  {
    profileId: "naver-band-copy-writer",
    authority: {
      owns: ["naverBand.copy"],
      reads: ["editorialNarrative.storySequence", "canonical.factualBoundary"],
      advisory: [],
      mustNotOwn: [
        "instagram.carouselStructure",
        "instagram.visualSemantics",
        "sharedVisual.masterOrchestration",
        "naverBlog.structure",
      ],
    },
    inputs: {
      required: ["editorialNarrative.storySequence"],
      optional: ["canonical.factualBoundary"],
    },
    output: { artifactId: NAVER_BAND_COPY_CONTRACT },
    docs: {
      notes: [
        "Phase 3D: lifecycle wired. OWNS channel-native wording; MUST NOT alter Canonical facts/Narrative meaning; no forced CTA.",
      ],
    },
  },

  // Department agents (Phase 3E — semantic registration only; no runtime/lifecycle change)
  {
    profileId: "content-strategist",
    authority: {
      owns: [
        "contentStrategy.proposition",
        "contentStrategy.contentPlan",
        "contentStrategy.draftScaffold",
      ],
      reads: [
        "content.assignment",
        "content.evidencePack",
        "content.selectedAgenda",
        "research.audienceContentBrief",
        "canonical.factualBoundary",
      ],
      advisory: ["governance.assessment", "performance.recommendation"],
      mustNotOwn: [
        "marketingManagement.agendaSelection",
        "instagram.cardCopy",
        "instagram.caption",
        "instagram.carouselStructure",
        "instagram.visualSemantics",
        "sharedVisual.masterOrchestration",
        "presentation.template",
        "astra.generationBrief",
        "threads.copy",
        "naverBlog.copy",
        "naverBand.copy",
        "governance.verdict",
        "publishable.bundle",
      ],
    },
    inputs: {
      required: ["content.assignment", "research.audienceContentBrief"],
      optional: ["content.evidencePack", "governance.assessment"],
    },
    docs: {
      notes: [
        "Durable domain outputs: content-plan-v1 + content-proposition-v1 (nested). Not in MarketingArtifactContract registry — docs-only mapping.",
        "Schema title/body draft is strategy scaffold only — Channel Composers own final publishable wording.",
        "Runtime validation authority: marketingPlanSpecialists.ts (not SOUL).",
      ],
    },
  },
  {
    profileId: "marketing-manager",
    authority: {
      owns: [
        "marketingManagement.orchestration",
        "marketingManagement.agendaSelection",
        "marketingManagement.assignmentHandoff",
      ],
      reads: [
        "contentStrategy.contentPlan",
        "contentStrategy.proposition",
        "governance.verdict",
        "governance.assessment",
        "performance.analysis",
        "performance.recommendation",
        "content.evidencePack",
        "research.audienceContentBrief",
      ],
      advisory: ["performance.recommendation"],
      mustNotOwn: [
        "contentStrategy.proposition",
        "canonical.factualBoundary",
        "instagram.cardCopy",
        "instagram.caption",
        "instagram.carouselStructure",
        "instagram.visualSemantics",
        "sharedVisual.masterOrchestration",
        "presentation.template",
        "astra.generationBrief",
        "threads.copy",
        "naverBlog.structure",
        "naverBlog.copy",
        "naverBand.copy",
        "governance.verdict",
      ],
    },
    inputs: {
      required: [],
      optional: [
        "contentStrategy.contentPlan",
        "governance.verdict",
        "performance.analysis",
        "research.audienceContentBrief",
      ],
    },
    docs: {
      notes: [
        "Orchestrator: run_department_orchestration is mandatory for department/performance/content+governance intents.",
        "Durable domain outputs (docs-only): selected-agenda-v1, content-assignment-v1 handoff. No MarketingArtifactContract entries.",
        "MUST NOT override governance verdict or publish. ALLOW → publish_ready stop only.",
      ],
    },
  },
  {
    profileId: "governance-auditor",
    authority: {
      owns: ["governance.assessment", "governance.verdict"],
      reads: [
        "contentStrategy.contentPlan",
        "contentStrategy.draftScaffold",
        "contentStrategy.proposition",
        "content.assignment",
        "content.evidencePack",
        "canonical.factualBoundary",
      ],
      advisory: [],
      mustNotOwn: [
        "contentStrategy.proposition",
        "contentStrategy.contentPlan",
        "contentStrategy.draftScaffold",
        "instagram.cardCopy",
        "instagram.caption",
        "instagram.carouselStructure",
        "instagram.visualSemantics",
        "sharedVisual.masterOrchestration",
        "presentation.template",
        "threads.copy",
        "naverBlog.copy",
        "naverBand.copy",
        "marketingManagement.agendaSelection",
        "performance.analysis",
      ],
    },
    inputs: {
      required: ["contentStrategy.draftScaffold", "content.evidencePack"],
      optional: ["contentStrategy.contentPlan", "content.assignment"],
    },
    docs: {
      notes: [
        "Owns ALLOW/REVIEW/BLOCK verdict (blocking decision). Does not rewrite content.",
        "Durable domain output (docs-only): governance-decision-v1 / GovernanceWorkflowResult. Not in MarketingArtifactContract registry.",
        "Structural completeness is Completeness Validator — not Governance.",
      ],
    },
  },
  {
    profileId: "performance-analyst",
    authority: {
      owns: ["performance.analysis", "performance.recommendation"],
      reads: ["content.selectedAgenda", "contentStrategy.contentPlan"],
      advisory: [],
      mustNotOwn: [
        "contentStrategy.proposition",
        "contentStrategy.contentPlan",
        "contentStrategy.draftScaffold",
        "marketingManagement.agendaSelection",
        "marketingManagement.orchestration",
        "governance.verdict",
        "governance.assessment",
        "instagram.cardCopy",
        "instagram.visualSemantics",
        "sharedVisual.masterOrchestration",
        "presentation.template",
        "threads.copy",
        "naverBlog.copy",
        "naverBand.copy",
        "publishable.bundle",
        "canonical.factualBoundary",
      ],
    },
    inputs: {
      required: [],
      optional: ["content.selectedAgenda", "contentStrategy.contentPlan"],
    },
    docs: {
      notes: [
        "Owns performance evidence summary + recommendations only. No production artifact mutation.",
        "Recommendations are advisory inputs to Marketing Manager (orchestration).",
        "Durable output (docs-only): { period, metrics, observations, confidence, recommendations, dataAvailability } — not MarketingArtifactContract.",
      ],
    },
  },
];

const BY_PROFILE = new Map(
  MARKETING_AGENT_SEMANTIC_REGISTRY.map((e) => [e.profileId, e]),
);

export function listMarketingAgentSemanticContracts(): readonly MarketingAgentSemanticContract[] {
  return MARKETING_AGENT_SEMANTIC_REGISTRY;
}

export function getMarketingAgentSemanticContract(
  profileId: string,
): MarketingAgentSemanticContract | undefined {
  return BY_PROFILE.get(profileId);
}

export function requireMarketingAgentSemanticContract(
  profileId: string,
): MarketingAgentSemanticContract {
  const entry = getMarketingAgentSemanticContract(profileId);
  if (!entry) {
    throw new Error(
      `Unknown marketing agent semantic contract (not registered): ${profileId}`,
    );
  }
  return entry;
}

/** All profile ids present in the semantic registry (Phase 3A specialists + later phases). */
export const PHASE_3A_SEMANTIC_MIGRATED_PROFILE_IDS = MARKETING_AGENT_SEMANTIC_REGISTRY.map(
  (e) => e.profileId,
);

/** Department profiles registered in Phase 3E. */
export const PHASE_3E_DEPARTMENT_PROFILE_IDS = [
  "content-strategist",
  "marketing-manager",
  "governance-auditor",
  "performance-analyst",
] as const;

export type Phase3eDepartmentProfileId = (typeof PHASE_3E_DEPARTMENT_PROFILE_IDS)[number];
