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
import { CARD_COPY_SEMANTIC_REGISTRY_NOTES } from "@/lib/marketing/agentContracts/cardCopyNaturalKoreanContract";

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
    docs: {
      notes: [
        "OWNS: story sequence + semantic reader promise (narrativePromise, audienceTakeaway, ordered beats purpose/message/evidenceRefs).",
        "MUST NOT: channel card copy, carousel structure, visual semantics, final consumer Korean for any channel.",
        "VOCABULARY BOUNDARY: planner fields (narrativePromise, beat.message, communicationGoal) are semantic instructions, not consumer surface wording or lexical copy seeds.",
        "Downstream writers preserve meaning but rewrite into natural consumer Korean — do not require verbatim preservation of planner phrasing.",
        "Internal structure terms (frame/reframe/payoff/context/rhythm) are allowed for planning; this is not a blacklist.",
        "promise / takeaway / beat.message are semantic planning fields — not polished surface-like editorial copy.",
        "High-risk fields describe the semantic job (establish/contrast/document/limit/leave open) — not reader transformation, lesson, or decision criterion.",
        "Payoff/closing may be concrete resolution: documented difference, person/place/building, evidence limitation, unresolved curiosity, or demonstrated contrast. No mandatory perspective/criterion/awareness transformation.",
        "Do not promote concrete Canonical facts into abstract reader outcomes unless Canonical supports that outcome.",
        "Downstream rewriting is not a substitute for good upstream semantic representation. Canonical-only facts required.",
      ],
    },
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
        "VOCABULARY BOUNDARY: planner fields (narrativePromise, beat.message, communicationGoal) are semantic instructions, not consumer surface wording or lexical copy seeds.",
        "Downstream writers preserve meaning but rewrite into natural consumer Korean — do not require verbatim preservation of planner phrasing.",
        "Internal structure terms (frame/reframe/payoff/context/rhythm) are allowed for planning; this is not a blacklist.",
        "communicationGoal = short concrete semantic job (show/distinguish/establish/resolve) — not a reader-transformation sentence about realizing/gaining/criteria.",
        "Closing may be a concrete resolution/recap of an established person/place/building/documented difference/limitation; no abstract criterion/insight/perspective payoff required.",
        "Do not paste Narrative payoff/takeaway/promise wording into communicationGoal.",
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
      required: [
        "instagram.carouselStructure",
        "editorialNarrative.storySequence",
        "canonical.factualBoundary",
      ],
    },
    output: { artifactId: INSTAGRAM_CARD_COPY_CONTRACT },
    docs: {
      notes: [
        ...CARD_COPY_SEMANTIC_REGISTRY_NOTES,
        "Surface compression must preserve Canonical geographic scope — do not infer geographic buckets from mixed named examples Canonical did not state; Canonical-supported regional labels remain allowed.",
      ],
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
      required: [
        "instagram.cardCopy",
        "instagram.carouselStructure",
        "editorialNarrative.storySequence",
        "canonical.factualBoundary",
      ],
    },
    output: { artifactId: INSTAGRAM_CAPTION_CONTRACT },
    docs: {
      notes: [
        "OWNS: caption opening/body/optional CTA/hashtags/altText only — separate from card copy.",
        "REQUIRED production inputs: Card Copy + Carousel plan + Narrative (promise/takeaway) + Canonical limitations/boundary (pipeline INPUT_JSON).",
        "Upstream Narrative / Carousel goals / Card Copy are semantic-context references, not lexical sources — rewrite abstract planner language into natural consumer Korean.",
        "MUST NOT: re-copy cards verbatim; redesign carousel; new visuals; facts beyond Canonical; abstract reflective lesson/criterion soft-question CTAs forced from takeaway.",
        "Hashtags: concrete destination/people/architecture/culture/topic; avoid abstract meta tags (perspective/insight/awareness/viewpoint).",
        "Opening: complete standalone reason to expand within roughly first 125 characters. Hard caption max remains 2200 (validate).",
      ],
    },
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
  // Channel copy — Threads specialist (Narrative → conversational body)
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
      required: [
        "editorialNarrative.storySequence",
        "canonical.factualBoundary",
      ],
    },
    output: { artifactId: THREADS_COPY_CONTRACT },
    docs: {
      notes: [
        "OWNS: Threads body wording + beat selection/compression + endingIntent (observation|soft_question|thought|none).",
        "REQUIRED inputs: Editorial Narrative Plan (sequence) + Approved Canonical (factual boundary) — pipeline fail-closed without both.",
        "Narrative is semantic guidance, not a lexical source; rewrite into natural conversational Korean.",
        "MUST NOT: invent facts/arc; forced CTA; abstract closing lesson/comparison-criterion synthesis from engagementIntentAdvisory.",
        "Length: preferred 180–420 Korean chars; hard max 500. Typically 2–4 short paragraphs.",
      ],
    },
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
      required: ["editorialNarrative.storySequence", "canonical.factualBoundary"],
      optional: [],
    },
    output: { artifactId: NAVER_BLOG_STRUCTURE_PLAN_CONTRACT },
    docs: {
      notes: [
        "OWNS: Blog section order, purpose, heading, openingIntent/conclusionIntent/ctaIntent, FAQ plan intent.",
        "REQUIRED inputs: Editorial Narrative Plan (sequence) + Approved Canonical (factual boundary) — pipeline fail-closed without both.",
        "Headings = concrete structural labels (place/people/architecture/record/contrast/limitation/question), not editorial synthesis.",
        "openingIntent/conclusionIntent = short concrete semantic planning, not final reader-facing prose.",
        "Closing may be concrete resolution/recap (documented difference, person/place/building, limitation, open question).",
        "Narrative promise/takeaway/beat.message are semantic sources, not wording templates for structure fields.",
      ],
    },
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
      required: [
        "naverBlog.structure",
        "editorialNarrative.storySequence",
        "canonical.factualBoundary",
      ],
      optional: [],
    },
    output: { artifactId: NAVER_BLOG_COPY_CONTRACT },
    docs: {
      notes: [
        "OWNS: final Blog Markdown surface Korean (title/body/section prose) within Structure order.",
        "REQUIRED inputs: Structure Plan + Editorial Narrative Plan + Approved Canonical — pipeline fail-closed without Canonical/Narrative upstream.",
        "Structure headings = subject/order labels to preserve; openingIntent/conclusionIntent = semantic planning guidance, not wording templates.",
        "Narrative promise/takeaway/beat.message = semantic progression only — rewrite into natural Korean; do not paste.",
        "Concrete closing valid: observation / documented difference / limitation / open question — no manufactured perspective/awareness/insight/criterion payoff.",
        "MUST NOT: invent facts; redesign Structure order/sections; forced sales CTA; unsupported geographic categories (남부 프레임).",
      ],
    },
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
      required: ["editorialNarrative.storySequence", "canonical.factualBoundary"],
      optional: [],
    },
    output: { artifactId: NAVER_BAND_COPY_CONTRACT },
    docs: {
      notes: [
        "OWNS: Band-native surface Korean (title/body) within short mobile community format.",
        "REQUIRED inputs: Editorial Narrative Plan + Approved Canonical — pipeline fail-closed without both.",
        "Narrative = semantic progression (promise/takeaway/beat.message), not wording templates.",
        "Concrete observation closing is valid: documented difference, person/place/building, or limitation.",
        "No mandatory perspective expansion / diversity lesson / insight / 'good starting point' takeaway synthesis.",
        "MUST NOT: invent facts; forced comment/save/sales CTA; collapse mixed-region frames into 남부/중부 buckets.",
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
