#!/usr/bin/env node
/**
 * Fail-fast Marketing Agent Semantic + Artifact contracts (Phase 3A/3B).
 *
 *   npm run check:marketing-agent-contracts
 */
import { assertMarketingAgentContractsHealthy } from "../src/lib/marketing/agentContracts/enforcement";
import {
  PHASE_3B_WIRED_ARTIFACT_IDS,
  assertArtifactDependsOn,
  assertFingerprintSourcesInclude,
  getArtifactFailurePolicy,
  getArtifactRepairAttemptBudget,
  requireOnGenerateFail,
} from "../src/lib/marketing/agentContracts/lifecycleHelpers";
import { SHARED_VISUAL_PLAN_CONTRACT } from "../src/lib/marketing/publishable/sharedVisualPlan/contracts";
import { MANUAL_ASTRA_HANDOFF_CONTRACT } from "../src/lib/marketing/publishable/manualAstraHandoff/contracts";
import { INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT } from "../src/lib/marketing/publishable/instagramVisualRole/contracts";

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

function main(): void {
  assertMarketingAgentContractsHealthy();
  assertPhase3bWiringParity();
  console.log("check:marketing-agent-contracts PASS");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
