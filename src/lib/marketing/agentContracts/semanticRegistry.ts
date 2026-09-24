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

/** Profile ids migrated into the semantic registry in Phase 3A. */
export const PHASE_3A_SEMANTIC_MIGRATED_PROFILE_IDS = MARKETING_AGENT_SEMANTIC_REGISTRY.map(
  (e) => e.profileId,
);
