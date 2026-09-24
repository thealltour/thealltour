import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PHASE_3B_WIRED_ARTIFACT_IDS,
  PHASE_3C_WIRED_ARTIFACT_IDS,
  assertArtifactDependsOn,
  assertFingerprintSourcesInclude,
  getArtifactDependencies,
  getArtifactFailurePolicy,
  getArtifactRepairAttemptBudget,
  requireMarketingArtifactContract,
  requireMaterializeInRepairLoop,
  requireOnGenerateFail,
} from "@/lib/marketing/agentContracts";
import { EDITORIAL_NARRATIVE_PLAN_CONTRACT } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import {
  resolveNarrativeRepairAttemptBudget,
  assertEditorialNarrativeArtifactContractParity,
} from "@/lib/marketing/publishable/editorialNarrative/ensureEditorialNarrativePlan";
import {
  INSTAGRAM_CAPTION_CONTRACT,
  INSTAGRAM_CARD_COPY_CONTRACT,
  INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import { assertInstagramEditorialArtifactContractParity } from "@/lib/marketing/publishable/instagramEditorial/pipeline";
import {
  resolveEditorialNarrativeLifecycle,
  resolveInstagramCarouselLifecycle,
  resolveInstagramCardCopyLifecycle,
  resolveInstagramCaptionLifecycle,
} from "@/lib/marketing/publishable/instagramEditorial/lifecycle";
import { CARD_PRESENTATION_PLAN_CONTRACT } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import {
  assertCardPresentationArtifactContractParity,
  buildDeterministicCardPresentationPlan,
} from "@/lib/marketing/assets/cardnews/presentation/deterministic";
import { resolveCardPresentationLifecycle } from "@/lib/marketing/assets/cardnews/presentation/fingerprint";
import { INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT } from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import { SHARED_VISUAL_PLAN_CONTRACT } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

describe("Phase 3C editorial & presentation lifecycle wiring", () => {
  it("A: Narrative — contract lookup, FP parity, repairAttempts, materialize outside loop, preserve_previous", () => {
    expect(requireMarketingArtifactContract(EDITORIAL_NARRATIVE_PLAN_CONTRACT).artifactId).toBe(
      EDITORIAL_NARRATIVE_PLAN_CONTRACT,
    );
    assertEditorialNarrativeArtifactContractParity();
    assertFingerprintSourcesInclude(EDITORIAL_NARRATIVE_PLAN_CONTRACT, [
      "sourceCanonicalFingerprint",
    ]);
    expect(getArtifactRepairAttemptBudget(EDITORIAL_NARRATIVE_PLAN_CONTRACT)).toBe(2);
    expect(resolveNarrativeRepairAttemptBudget()).toBe(2);
    requireMaterializeInRepairLoop(EDITORIAL_NARRATIVE_PLAN_CONTRACT, false);
    requireOnGenerateFail(EDITORIAL_NARRATIVE_PLAN_CONTRACT, "preserve_previous");

    const ensureSrc = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/editorialNarrative/ensureEditorialNarrativePlan.ts"),
      "utf8",
    );
    expect(ensureSrc).toMatch(/resolveNarrativeRepairAttemptBudget|getArtifactRepairAttemptBudget/);
    expect(ensureSrc).toMatch(/materializeEditorialNarrativePlan\(/);
    expect(ensureSrc).toMatch(/preserve_previous/);
    // materialize must remain outside the attempt loop
    const loopStart = ensureSrc.indexOf("for (let attempt = 1; attempt <= input.maxAttempts");
    const materializeAt = ensureSrc.indexOf("materializeEditorialNarrativePlan(", loopStart);
    const loopEnd = ensureSrc.indexOf("throw lastError", loopStart);
    expect(loopStart).toBeGreaterThan(-1);
    expect(loopEnd).toBeGreaterThan(loopStart);
    expect(materializeAt).toBeGreaterThan(loopEnd);

    expect(
      resolveEditorialNarrativeLifecycle({
        plan: {
          contract: EDITORIAL_NARRATIVE_PLAN_CONTRACT,
          assetId: "a",
          assetVersion: 1,
          narrativePromise: "p",
          audienceTakeaway: "t",
          beats: [],
          sourceCanonicalFingerprint: "fp-a",
          provenance: {
            sourceAssetId: "a",
            sourceVersion: 1,
            modelProfile: "editorial-narrative-planner",
            generatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
        expectedCanonicalFingerprint: "fp-a",
      }),
    ).toBe("fresh");
    expect(
      resolveEditorialNarrativeLifecycle({
        plan: {
          contract: EDITORIAL_NARRATIVE_PLAN_CONTRACT,
          assetId: "a",
          assetVersion: 1,
          narrativePromise: "p",
          audienceTakeaway: "t",
          beats: [],
          sourceCanonicalFingerprint: "fp-old",
          provenance: {
            sourceAssetId: "a",
            sourceVersion: 1,
            modelProfile: "editorial-narrative-planner",
            generatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
        expectedCanonicalFingerprint: "fp-new",
      }),
    ).toBe("stale");
  });

  it("B: Carousel — Narrative dependency, materialize outside loop, fail_closed, stale on Narrative FP", () => {
    assertInstagramEditorialArtifactContractParity();
    assertArtifactDependsOn(INSTAGRAM_CAROUSEL_PLAN_CONTRACT, EDITORIAL_NARRATIVE_PLAN_CONTRACT);
    assertFingerprintSourcesInclude(INSTAGRAM_CAROUSEL_PLAN_CONTRACT, [
      "sourceNarrativeFingerprint",
    ]);
    requireOnGenerateFail(INSTAGRAM_CAROUSEL_PLAN_CONTRACT, "fail_closed");
    requireMaterializeInRepairLoop(INSTAGRAM_CAROUSEL_PLAN_CONTRACT, false);
    expect(getArtifactRepairAttemptBudget(INSTAGRAM_CAROUSEL_PLAN_CONTRACT)).toBe(2);

    const pipelineSrc = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/instagramEditorial/pipeline.ts"),
      "utf8",
    );
    expect(pipelineSrc).toMatch(/getArtifactRepairAttemptBudget\(INSTAGRAM_CAROUSEL_PLAN_CONTRACT\)/);
    expect(pipelineSrc).toMatch(/materializeInRepairLoop=false/);
    const carouselInv = pipelineSrc.indexOf("task: \"instagram_carousel_plan\"");
    const carouselMat = pipelineSrc.indexOf("materializeInstagramCarouselPlan(", carouselInv);
    // materialize after invokeJson return (outside repair loop body)
    expect(carouselMat).toBeGreaterThan(carouselInv);
    expect(pipelineSrc).toMatch(/failedContent\(/);

    const narrative = {
      contract: EDITORIAL_NARRATIVE_PLAN_CONTRACT,
      assetId: "a",
      assetVersion: 1,
      narrativePromise: "p",
      audienceTakeaway: "t",
      beats: [{ beatId: "b1", purpose: "hook" as const, message: "m" }],
      sourceCanonicalFingerprint: "cfp",
      provenance: {
        sourceAssetId: "a",
        sourceVersion: 1,
        modelProfile: "editorial-narrative-planner",
        generatedAt: "2026-01-01T00:00:00.000Z",
      },
    };
    expect(
      resolveInstagramCarouselLifecycle({
        plan: {
          contract: INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
          assetId: "a",
          assetVersion: 1,
          cards: [],
          sourceNarrativeFingerprint: "wrong",
          provenance: {
            sourceAssetId: "a",
            sourceVersion: 1,
            sourceUpstreamFingerprint: "wrong",
            modelProfile: "instagram-carousel-planner",
            generatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
        narrative,
      }),
    ).toBe("stale");
  });

  it("C: Card Copy — Carousel dependency, lifecycle parity, fail_closed", () => {
    assertArtifactDependsOn(INSTAGRAM_CARD_COPY_CONTRACT, INSTAGRAM_CAROUSEL_PLAN_CONTRACT);
    assertFingerprintSourcesInclude(INSTAGRAM_CARD_COPY_CONTRACT, [
      "sourceCarouselFingerprint",
    ]);
    requireOnGenerateFail(INSTAGRAM_CARD_COPY_CONTRACT, "fail_closed");
    requireMaterializeInRepairLoop(INSTAGRAM_CARD_COPY_CONTRACT, false);
    expect(getArtifactRepairAttemptBudget(INSTAGRAM_CARD_COPY_CONTRACT)).toBe(2);

    expect(
      resolveInstagramCardCopyLifecycle({
        copy: null,
        carousel: null,
      }),
    ).toBe("not_generated");
  });

  it("D: Caption — visual chain independent, lifecycle parity, fail_closed", () => {
    assertArtifactDependsOn(INSTAGRAM_CAPTION_CONTRACT, INSTAGRAM_CARD_COPY_CONTRACT);
    assertFingerprintSourcesInclude(INSTAGRAM_CAPTION_CONTRACT, [
      "sourceCardCopyFingerprint",
    ]);
    requireOnGenerateFail(INSTAGRAM_CAPTION_CONTRACT, "fail_closed");
    requireMaterializeInRepairLoop(INSTAGRAM_CAPTION_CONTRACT, false);

    const deps = getArtifactDependencies(INSTAGRAM_CAPTION_CONTRACT);
    expect(deps).not.toContain(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT);
    expect(deps).not.toContain(SHARED_VISUAL_PLAN_CONTRACT);

    expect(
      resolveInstagramCaptionLifecycle({
        caption: null,
        cardCopy: null,
      }),
    ).toBe("not_generated");
  });

  it("E: Presentation — deterministic_fallback wired; LLM not required; FP stale", () => {
    assertCardPresentationArtifactContractParity();
    requireOnGenerateFail(CARD_PRESENTATION_PLAN_CONTRACT, "deterministic_fallback");
    requireMaterializeInRepairLoop(CARD_PRESENTATION_PLAN_CONTRACT, false);
    assertFingerprintSourcesInclude(CARD_PRESENTATION_PLAN_CONTRACT, [
      "provenance.sourceInstagramFingerprint",
      "provenance.sourceVisualPlanFingerprint",
    ]);

    const plan = buildDeterministicCardPresentationPlan({
      assetId: "pkg",
      assetVersion: 1,
      sourceInstagramFingerprint: "ig-fp-1",
      cards: [{ cardId: "c1", role: "cover", hasVisual: false }],
    });
    expect(plan.provenance.modelProfile).toMatch(/:deterministic$/);
    expect(resolveCardPresentationLifecycle({
      plan,
      expectedInstagramFingerprint: "ig-fp-1",
    })).toBe("fresh");
    expect(resolveCardPresentationLifecycle({
      plan,
      expectedInstagramFingerprint: "ig-fp-changed",
    })).toBe("stale");

    const renderSrc = readFileSync(
      join(process.cwd(), "src/lib/marketing/assets/cardnews/renderCardNewsPackage.ts"),
      "utf8",
    );
    expect(renderSrc).toMatch(/assertCardPresentationArtifactContractParity/);
    expect(renderSrc).toMatch(/deterministic_fallback/);
    // Must not wire Layout Hermes production invoke
    expect(renderSrc).not.toMatch(/invoke.*card-layout-director|card-layout-director.*invoke/i);
  });

  it("F: drift detection — contract/code mismatch fixtures FAIL", () => {
    expect(() =>
      requireOnGenerateFail(EDITORIAL_NARRATIVE_PLAN_CONTRACT, "fail_closed"),
    ).toThrow(/onGenerateFail=preserve_previous/);
    expect(() =>
      requireMaterializeInRepairLoop(INSTAGRAM_CAROUSEL_PLAN_CONTRACT, true),
    ).toThrow(/materializeInRepairLoop=false/);
    expect(() =>
      requireOnGenerateFail(CARD_PRESENTATION_PLAN_CONTRACT, "fail_closed"),
    ).toThrow(/onGenerateFail=deterministic_fallback/);
    expect(() =>
      assertFingerprintSourcesInclude(INSTAGRAM_CAPTION_CONTRACT, ["sourceVisualPlanFingerprint"]),
    ).toThrow(/missing fingerprintSource/);
  });

  it("G: Phase 3B VRA/SVP/Astra regression — wired ids still present", () => {
    for (const id of PHASE_3B_WIRED_ARTIFACT_IDS) {
      expect(requireMarketingArtifactContract(id).artifactId).toBe(id);
    }
    expect(getArtifactFailurePolicy(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT).materializeInRepairLoop).toBe(
      true,
    );
    requireOnGenerateFail(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT, "fail_closed");
    requireOnGenerateFail(SHARED_VISUAL_PLAN_CONTRACT, "preserve_previous");

    for (const id of PHASE_3C_WIRED_ARTIFACT_IDS) {
      expect(getArtifactFailurePolicy(id)).toBeTruthy();
    }
  });
});
