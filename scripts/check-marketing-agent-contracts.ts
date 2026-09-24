#!/usr/bin/env node
/**
 * Fail-fast Marketing Agent Semantic + Artifact contracts (Phase 3A–3D).
 *
 *   npm run check:marketing-agent-contracts
 */
import { assertMarketingAgentContractsHealthy } from "../src/lib/marketing/agentContracts/enforcement";
import {
  PHASE_3B_WIRED_ARTIFACT_IDS,
  PHASE_3C_WIRED_ARTIFACT_IDS,
  PHASE_3D_WIRED_ARTIFACT_IDS,
  assertArtifactDependsOn,
  assertFingerprintSourcesInclude,
  getArtifactDependencies,
  getArtifactFailurePolicy,
  getArtifactRepairAttemptBudget,
  requireMaterializeInRepairLoop,
  requireOnGenerateFail,
} from "../src/lib/marketing/agentContracts/lifecycleHelpers";
import { SHARED_VISUAL_PLAN_CONTRACT } from "../src/lib/marketing/publishable/sharedVisualPlan/contracts";
import { MANUAL_ASTRA_HANDOFF_CONTRACT } from "../src/lib/marketing/publishable/manualAstraHandoff/contracts";
import { INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT } from "../src/lib/marketing/publishable/instagramVisualRole/contracts";
import { EDITORIAL_NARRATIVE_PLAN_CONTRACT } from "../src/lib/marketing/publishable/editorialNarrative/contracts";
import {
  INSTAGRAM_CAPTION_CONTRACT,
  INSTAGRAM_CARD_COPY_CONTRACT,
  INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
} from "../src/lib/marketing/publishable/instagramEditorial/contracts";
import { CARD_PRESENTATION_PLAN_CONTRACT } from "../src/lib/marketing/assets/cardnews/presentation/contracts";
import { THREADS_COPY_CONTRACT } from "../src/lib/marketing/publishable/threadsCopy/contracts";
import {
  NAVER_BLOG_COPY_CONTRACT,
  NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
} from "../src/lib/marketing/publishable/naverBlogEditorial/contracts";
import { NAVER_BAND_COPY_CONTRACT } from "../src/lib/marketing/publishable/naverBandCopy/contracts";

function assertPhase3bWiringParity(): void {
  for (const id of PHASE_3B_WIRED_ARTIFACT_IDS) {
    getArtifactFailurePolicy(id);
  }

  requireOnGenerateFail(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT, "fail_closed");
  if (getArtifactFailurePolicy(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT).materializeInRepairLoop !== true) {
    throw new Error("VRA materializeInRepairLoop must be true");
  }
  if (getArtifactRepairAttemptBudget(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT) < 1) {
    throw new Error("VRA repairAttempts must be >= 1");
  }
  assertFingerprintSourcesInclude(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT, [
    "sourceCarouselFingerprint",
    "sourceCardCopyFingerprint",
  ]);

  requireOnGenerateFail(SHARED_VISUAL_PLAN_CONTRACT, "preserve_previous");
  assertFingerprintSourcesInclude(SHARED_VISUAL_PLAN_CONTRACT, [
    "sourceVisualPlanFingerprint",
    "sourceInstagramVisualRoleFingerprint",
  ]);

  requireOnGenerateFail(MANUAL_ASTRA_HANDOFF_CONTRACT, "preserve_previous");
  assertArtifactDependsOn(MANUAL_ASTRA_HANDOFF_CONTRACT, SHARED_VISUAL_PLAN_CONTRACT);
  assertFingerprintSourcesInclude(MANUAL_ASTRA_HANDOFF_CONTRACT, [
    "sourceSharedVisualPlanFingerprint",
  ]);
}

function assertPhase3cWiringParity(): void {
  for (const id of PHASE_3C_WIRED_ARTIFACT_IDS) {
    getArtifactFailurePolicy(id);
  }

  requireOnGenerateFail(EDITORIAL_NARRATIVE_PLAN_CONTRACT, "preserve_previous");
  requireMaterializeInRepairLoop(EDITORIAL_NARRATIVE_PLAN_CONTRACT, false);
  if (getArtifactRepairAttemptBudget(EDITORIAL_NARRATIVE_PLAN_CONTRACT) !== 2) {
    throw new Error("Narrative repairAttempts must be 2");
  }
  assertFingerprintSourcesInclude(EDITORIAL_NARRATIVE_PLAN_CONTRACT, [
    "sourceCanonicalFingerprint",
  ]);

  for (const id of [
    INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
    INSTAGRAM_CARD_COPY_CONTRACT,
    INSTAGRAM_CAPTION_CONTRACT,
  ] as const) {
    requireOnGenerateFail(id, "fail_closed");
    requireMaterializeInRepairLoop(id, false);
    if (getArtifactRepairAttemptBudget(id) !== 2) {
      throw new Error(`${id} repairAttempts must be 2`);
    }
  }
  assertArtifactDependsOn(INSTAGRAM_CAROUSEL_PLAN_CONTRACT, EDITORIAL_NARRATIVE_PLAN_CONTRACT);
  assertFingerprintSourcesInclude(INSTAGRAM_CAROUSEL_PLAN_CONTRACT, [
    "sourceNarrativeFingerprint",
  ]);
  assertArtifactDependsOn(INSTAGRAM_CARD_COPY_CONTRACT, INSTAGRAM_CAROUSEL_PLAN_CONTRACT);
  assertFingerprintSourcesInclude(INSTAGRAM_CARD_COPY_CONTRACT, [
    "sourceCarouselFingerprint",
  ]);
  assertArtifactDependsOn(INSTAGRAM_CAPTION_CONTRACT, INSTAGRAM_CARD_COPY_CONTRACT);
  assertFingerprintSourcesInclude(INSTAGRAM_CAPTION_CONTRACT, [
    "sourceCardCopyFingerprint",
  ]);
  const captionDeps = getArtifactDependencies(INSTAGRAM_CAPTION_CONTRACT);
  if (
    captionDeps.includes(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT) ||
    captionDeps.includes(SHARED_VISUAL_PLAN_CONTRACT)
  ) {
    throw new Error("Caption must not depend on VRA/SVP");
  }

  requireOnGenerateFail(CARD_PRESENTATION_PLAN_CONTRACT, "deterministic_fallback");
  requireMaterializeInRepairLoop(CARD_PRESENTATION_PLAN_CONTRACT, false);
  assertFingerprintSourcesInclude(CARD_PRESENTATION_PLAN_CONTRACT, [
    "provenance.sourceInstagramFingerprint",
    "provenance.sourceVisualPlanFingerprint",
  ]);

  if (getArtifactFailurePolicy(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT).materializeInRepairLoop !== true) {
    throw new Error("Phase 3C regression: VRA materializeInRepairLoop must remain true");
  }
  if (getArtifactFailurePolicy(INSTAGRAM_CAROUSEL_PLAN_CONTRACT).materializeInRepairLoop !== false) {
    throw new Error("Phase 3C: Carousel materializeInRepairLoop must remain false");
  }
}

function assertPhase3dWiringParity(): void {
  for (const id of PHASE_3D_WIRED_ARTIFACT_IDS) {
    getArtifactFailurePolicy(id);
    requireOnGenerateFail(id, "fail_closed");
    requireMaterializeInRepairLoop(id, false);
    if (getArtifactRepairAttemptBudget(id) !== 2) {
      throw new Error(`${id} repairAttempts must be 2`);
    }
  }

  assertArtifactDependsOn(THREADS_COPY_CONTRACT, EDITORIAL_NARRATIVE_PLAN_CONTRACT);
  assertFingerprintSourcesInclude(THREADS_COPY_CONTRACT, ["sourceNarrativeFingerprint"]);

  assertArtifactDependsOn(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT, EDITORIAL_NARRATIVE_PLAN_CONTRACT);
  assertFingerprintSourcesInclude(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT, [
    "sourceNarrativeFingerprint",
  ]);

  assertArtifactDependsOn(NAVER_BLOG_COPY_CONTRACT, NAVER_BLOG_STRUCTURE_PLAN_CONTRACT);
  assertFingerprintSourcesInclude(NAVER_BLOG_COPY_CONTRACT, ["sourceStructureFingerprint"]);

  assertArtifactDependsOn(NAVER_BAND_COPY_CONTRACT, EDITORIAL_NARRATIVE_PLAN_CONTRACT);
  assertFingerprintSourcesInclude(NAVER_BAND_COPY_CONTRACT, ["sourceNarrativeFingerprint"]);
}

function main(): void {
  assertMarketingAgentContractsHealthy();
  assertPhase3bWiringParity();
  assertPhase3cWiringParity();
  assertPhase3dWiringParity();
  console.log("check:marketing-agent-contracts PASS");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
