import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PHASE_3B_WIRED_ARTIFACT_IDS,
  assertArtifactDependsOn,
  assertFingerprintSourcesInclude,
  getArtifactFailurePolicy,
  getArtifactRepairAttemptBudget,
  requireMarketingArtifactContract,
  requireMaterializeInRepairLoop,
  requireOnGenerateFail,
} from "@/lib/marketing/agentContracts";
import { INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT } from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import { SHARED_VISUAL_PLAN_CONTRACT } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import { MANUAL_ASTRA_HANDOFF_CONTRACT } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import { resolveVraRepairAttemptBudget } from "@/lib/marketing/publishable/instagramVisualRole/pipeline";

describe("Phase 3B contract-driven lifecycle wiring", () => {
  it("A: VRA/SVP/Astra contracts exist; unknown id fails", () => {
    for (const id of PHASE_3B_WIRED_ARTIFACT_IDS) {
      expect(requireMarketingArtifactContract(id).artifactId).toBe(id);
    }
    expect(() => requireMarketingArtifactContract("not-wired-artifact-v9")).toThrow(
      /Unknown marketing artifact/i,
    );
  });

  it("B: VRA repairAttempts + materializeInRepairLoop + fail_closed", () => {
    const policy = getArtifactFailurePolicy(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT);
    expect(policy.repairAttempts).toBe(2);
    expect(policy.materializeInRepairLoop).toBe(true);
    expect(policy.onGenerateFail).toBe("fail_closed");
    expect(getArtifactRepairAttemptBudget(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT)).toBe(2);
    expect(resolveVraRepairAttemptBudget()).toBe(2);
    requireOnGenerateFail(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT, "fail_closed");

    const pipelineSrc = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/instagramVisualRole/pipeline.ts"),
      "utf8",
    );
    // materialize must remain inside the attempt loop (contract materializeInRepairLoop)
    expect(pipelineSrc).toMatch(/for \(let attempt = 1; attempt <= maxAttempts/);
    expect(pipelineSrc).toMatch(/materializeInstagramVisualRolePlan\(/);
    const loopStart = pipelineSrc.indexOf("for (let attempt = 1; attempt <= maxAttempts");
    const materializeAt = pipelineSrc.indexOf("materializeInstagramVisualRolePlan(", loopStart);
    const loopCatch = pipelineSrc.indexOf("} catch (error) {", materializeAt);
    expect(materializeAt).toBeGreaterThan(loopStart);
    expect(loopCatch).toBeGreaterThan(materializeAt);
  });

  it("C: SVP preserve_previous + materializeInRepairLoop decision-trace repair", () => {
    const policy = getArtifactFailurePolicy(SHARED_VISUAL_PLAN_CONTRACT);
    expect(policy.onGenerateFail).toBe("preserve_previous");
    expect(policy.materializeInRepairLoop).toBe(true);
    expect(policy.repairAttempts).toBe(2);
    expect(getArtifactRepairAttemptBudget(SHARED_VISUAL_PLAN_CONTRACT)).toBe(2);
    requireOnGenerateFail(SHARED_VISUAL_PLAN_CONTRACT, "preserve_previous");
    requireMaterializeInRepairLoop(SHARED_VISUAL_PLAN_CONTRACT, true);

    const src = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/visualOrchestration/generateSharedVisualPlan.ts"),
      "utf8",
    );
    expect(src).toMatch(/case "preserve_previous"/);
    expect(src).toMatch(/getArtifactFailurePolicy\(SHARED_VISUAL_PLAN_CONTRACT\)/);
    expect(src).toMatch(/deterministic_fallback is not supported/);
    expect(src).toMatch(/for \(let attempt = 1; attempt <= maxAttempts/);
    expect(src).toMatch(/materializeSharedVisualPlanFromLlm\(/);
    expect(src).toMatch(/isSvpDecisionTraceRepairableError/);
    const loopStart = src.indexOf("for (let attempt = 1; attempt <= maxAttempts");
    const materializeAt = src.indexOf("materializeSharedVisualPlanFromLlm(", loopStart);
    const loopCatch = src.indexOf("} catch (error) {", materializeAt);
    expect(materializeAt).toBeGreaterThan(loopStart);
    expect(loopCatch).toBeGreaterThan(materializeAt);
  });

  it("D: Astra dependsOn SVP + preserve_previous + stale refuse wiring", () => {
    assertArtifactDependsOn(MANUAL_ASTRA_HANDOFF_CONTRACT, SHARED_VISUAL_PLAN_CONTRACT);
    expect(() =>
      assertArtifactDependsOn(MANUAL_ASTRA_HANDOFF_CONTRACT, "instagram-carousel-plan-v1"),
    ).toThrow(/does not declare dependsOn/i);
    expect(getArtifactFailurePolicy(MANUAL_ASTRA_HANDOFF_CONTRACT).onGenerateFail).toBe(
      "preserve_previous",
    );
    const src = readFileSync(
      join(
        process.cwd(),
        "src/lib/marketing/publishable/visualOrchestration/generateManualAstraHandoff.ts",
      ),
      "utf8",
    );
    expect(src).toMatch(/assertArtifactDependsOn\(MANUAL_ASTRA_HANDOFF_CONTRACT/);
    expect(src).toMatch(/shared_visual_plan_stale/);
    expect(src).toMatch(/case "preserve_previous"/);
  });

  it("E: fingerprint parity — metadata sources match wired code", () => {
    assertFingerprintSourcesInclude(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT, [
      "sourceCarouselFingerprint",
      "sourceCardCopyFingerprint",
    ]);
    assertFingerprintSourcesInclude(SHARED_VISUAL_PLAN_CONTRACT, [
      "sourceVisualPlanFingerprint",
      "sourceInstagramVisualRoleFingerprint",
    ]);
    assertFingerprintSourcesInclude(MANUAL_ASTRA_HANDOFF_CONTRACT, [
      "sourceSharedVisualPlanFingerprint",
    ]);

    const vraPipeline = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/instagramVisualRole/pipeline.ts"),
      "utf8",
    );
    expect(vraPipeline).toMatch(/sourceCarouselFingerprint/);
    expect(vraPipeline).toMatch(/sourceCardCopyFingerprint/);

    const vraLifecycle = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/instagramVisualRole/lifecycle.ts"),
      "utf8",
    );
    expect(vraLifecycle).toMatch(/sourceCarouselFingerprint/);
    expect(vraLifecycle).toMatch(/sourceCardCopyFingerprint/);

    const visualLifecycle = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/visualOrchestration/lifecycle.ts"),
      "utf8",
    );
    expect(visualLifecycle).toMatch(/sourceInstagramVisualRoleFingerprint/);
    expect(visualLifecycle).toMatch(/sourceVisualPlanFingerprint|sourceChannelSnapshot/);
  });

  it("F: drift detection — requireOnGenerateFail mismatch throws", () => {
    expect(() =>
      requireOnGenerateFail(SHARED_VISUAL_PLAN_CONTRACT, "fail_closed"),
    ).toThrow(/onGenerateFail=preserve_previous/);
  });
});
