import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MARKETING_AGENT_CONTRACT_DEBT,
  PHASE_3B_WIRED_ARTIFACT_IDS,
  PHASE_3C_WIRED_ARTIFACT_IDS,
  PHASE_3D_WIRED_ARTIFACT_IDS,
  assertArtifactDependsOn,
  assertFingerprintSourcesInclude,
  getArtifactFailurePolicy,
  getArtifactRepairAttemptBudget,
  requireMarketingAgentSemanticContract,
  requireMarketingArtifactContract,
  requireMaterializeInRepairLoop,
  requireOnGenerateFail,
} from "@/lib/marketing/agentContracts";
import { EDITORIAL_NARRATIVE_PLAN_CONTRACT } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { THREADS_COPY_CONTRACT } from "@/lib/marketing/publishable/threadsCopy/contracts";
import {
  assertThreadsCopyArtifactContractParity,
  resolveThreadsCopyRepairAttemptBudget,
} from "@/lib/marketing/publishable/threadsCopy/pipeline";
import {
  NAVER_BLOG_COPY_CONTRACT,
  NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { assertNaverBlogEditorialArtifactContractParity } from "@/lib/marketing/publishable/naverBlogEditorial/pipeline";
import { NAVER_BAND_COPY_CONTRACT } from "@/lib/marketing/publishable/naverBandCopy/contracts";
import {
  assertNaverBandCopyArtifactContractParity,
  resolveNaverBandCopyRepairAttemptBudget,
} from "@/lib/marketing/publishable/naverBandCopy/pipeline";

describe("Phase 3D channel lifecycle wiring", () => {
  it("A: Threads — contract, Narrative dep/FP, repair, materialize outside, fail_closed", () => {
    expect(requireMarketingArtifactContract(THREADS_COPY_CONTRACT).artifactId).toBe(
      THREADS_COPY_CONTRACT,
    );
    assertThreadsCopyArtifactContractParity();
    assertArtifactDependsOn(THREADS_COPY_CONTRACT, EDITORIAL_NARRATIVE_PLAN_CONTRACT);
    assertFingerprintSourcesInclude(THREADS_COPY_CONTRACT, ["sourceNarrativeFingerprint"]);
    expect(getArtifactRepairAttemptBudget(THREADS_COPY_CONTRACT)).toBe(2);
    expect(resolveThreadsCopyRepairAttemptBudget()).toBe(2);
    requireMaterializeInRepairLoop(THREADS_COPY_CONTRACT, false);
    requireOnGenerateFail(THREADS_COPY_CONTRACT, "fail_closed");

    const src = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/threadsCopy/pipeline.ts"),
      "utf8",
    );
    expect(src).toMatch(/getArtifactRepairAttemptBudget|resolveThreadsCopyRepairAttemptBudget/);
    expect(src).toMatch(/materializeInRepairLoop=false/);
    expect(src).toMatch(/failedContent\(/);
    const loopStart = src.indexOf("for (let attempt = 1; attempt <= input.maxAttempts");
    const materializeAt = src.indexOf("materializeThreadsCopy(", loopStart);
    const loopEnd = src.indexOf("throw lastError", loopStart);
    expect(loopStart).toBeGreaterThan(-1);
    expect(materializeAt).toBeGreaterThan(loopEnd);
  });

  it("B: Blog Structure — Narrative dependency, FP parity, fail_closed, materialize outside", () => {
    assertNaverBlogEditorialArtifactContractParity();
    assertArtifactDependsOn(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT, EDITORIAL_NARRATIVE_PLAN_CONTRACT);
    assertFingerprintSourcesInclude(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT, [
      "sourceNarrativeFingerprint",
    ]);
    requireOnGenerateFail(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT, "fail_closed");
    requireMaterializeInRepairLoop(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT, false);
    expect(getArtifactRepairAttemptBudget(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT)).toBe(2);

    const src = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/naverBlogEditorial/pipeline.ts"),
      "utf8",
    );
    expect(src).toMatch(/sourceNarrativeFingerprint/);
    expect(src).toMatch(/materializeNaverBlogStructurePlan\(/);
    expect(src).toMatch(/materializeInRepairLoop=false/);
  });

  it("C: Blog Copy — Structure dependency, sourceStructureFingerprint, fail_closed", () => {
    assertArtifactDependsOn(NAVER_BLOG_COPY_CONTRACT, NAVER_BLOG_STRUCTURE_PLAN_CONTRACT);
    assertFingerprintSourcesInclude(NAVER_BLOG_COPY_CONTRACT, ["sourceStructureFingerprint"]);
    requireOnGenerateFail(NAVER_BLOG_COPY_CONTRACT, "fail_closed");
    requireMaterializeInRepairLoop(NAVER_BLOG_COPY_CONTRACT, false);
    expect(getArtifactRepairAttemptBudget(NAVER_BLOG_COPY_CONTRACT)).toBe(2);

    const src = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/naverBlogEditorial/pipeline.ts"),
      "utf8",
    );
    expect(src).toMatch(/sourceStructureFingerprint/);
    expect(src).toMatch(/materializeNaverBlogCopy\(/);
  });

  it("D: Band — Narrative dep/FP, fail_closed, no forced CTA semantics change", () => {
    assertNaverBandCopyArtifactContractParity();
    assertArtifactDependsOn(NAVER_BAND_COPY_CONTRACT, EDITORIAL_NARRATIVE_PLAN_CONTRACT);
    assertFingerprintSourcesInclude(NAVER_BAND_COPY_CONTRACT, ["sourceNarrativeFingerprint"]);
    requireOnGenerateFail(NAVER_BAND_COPY_CONTRACT, "fail_closed");
    requireMaterializeInRepairLoop(NAVER_BAND_COPY_CONTRACT, false);
    expect(resolveNaverBandCopyRepairAttemptBudget()).toBe(2);

    const src = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/naverBandCopy/pipeline.ts"),
      "utf8",
    );
    expect(src).toMatch(/No forced comment\/save CTA/);
    expect(src).toMatch(/materializeInRepairLoop=false/);
    expect(src).toMatch(/failedContent\(/);
  });

  it("E: Drift — metadata mismatch fixtures FAIL", () => {
    expect(() => requireOnGenerateFail(THREADS_COPY_CONTRACT, "preserve_previous")).toThrow(
      /onGenerateFail=fail_closed/,
    );
    expect(() => requireMaterializeInRepairLoop(NAVER_BAND_COPY_CONTRACT, true)).toThrow(
      /materializeInRepairLoop=false/,
    );
    expect(() =>
      assertFingerprintSourcesInclude(NAVER_BLOG_COPY_CONTRACT, ["sourceNarrativeFingerprint"]),
    ).toThrow(/missing fingerprintSource/);
  });

  it("F: Semantic invariants — structure/copy authority boundaries", () => {
    const threads = requireMarketingAgentSemanticContract("threads-copy-writer");
    expect(threads.authority.owns).toContain("threads.copy");
    expect(threads.authority.mustNotOwn).toEqual(
      expect.arrayContaining(["instagram.carouselStructure", "instagram.visualSemantics"]),
    );

    const structure = requireMarketingAgentSemanticContract("naver-blog-structure-planner");
    expect(structure.authority.owns).toContain("naverBlog.structure");
    expect(structure.authority.mustNotOwn).toContain("naverBlog.copy");

    const blogCopy = requireMarketingAgentSemanticContract("naver-blog-copy-writer");
    expect(blogCopy.authority.owns).toContain("naverBlog.copy");
    expect(blogCopy.authority.mustNotOwn).toContain("naverBlog.structure");
    expect(blogCopy.inputs.required).toContain("naverBlog.structure");

    const band = requireMarketingAgentSemanticContract("naver-band-copy-writer");
    expect(band.authority.owns).toContain("naverBand.copy");
    expect(band.authority.reads).toEqual(
      expect.arrayContaining(["editorialNarrative.storySequence", "canonical.factualBoundary"]),
    );
  });

  it("G: Regression — Phase 3B/3C wired ids + legacy channel-editor exclusion", () => {
    for (const id of PHASE_3B_WIRED_ARTIFACT_IDS) {
      expect(requireMarketingArtifactContract(id).artifactId).toBe(id);
    }
    for (const id of PHASE_3C_WIRED_ARTIFACT_IDS) {
      expect(getArtifactFailurePolicy(id)).toBeTruthy();
    }
    for (const id of PHASE_3D_WIRED_ARTIFACT_IDS) {
      expect(getArtifactFailurePolicy(id).onGenerateFail).toBe("fail_closed");
      expect(getArtifactFailurePolicy(id).materializeInRepairLoop).toBe(false);
    }

    expect(MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.kind === "legacy_channel_editor")).toBe(true);
    expect(MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.id === "naver-band-copy")).toBe(false);
    expect(MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.id === "spike-alias-usage")).toBe(true);
    expect(MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.id === "layout-hermes-production-ambiguity")).toBe(
      true,
    );

    // Production specialist pipelines must not silent-fallback to legacy channel-editor.
    for (const rel of [
      "src/lib/marketing/publishable/threadsCopy/pipeline.ts",
      "src/lib/marketing/publishable/naverBlogEditorial/pipeline.ts",
      "src/lib/marketing/publishable/naverBandCopy/pipeline.ts",
    ]) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src).not.toMatch(/channel-editor-/);
    }
  });

  it("publishable producer source invariant — channel copy assemble paths exist", () => {
    const threadsAssemble = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/threadsCopy/assemblePublishable.ts"),
      "utf8",
    );
    expect(threadsAssemble).toMatch(/assemblePublishableThreadsFromCopy|PUBLISHABLE_CHANNEL_CONTENT/);

    const blogAssemble = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/naverBlogEditorial/assemblePublishable.ts"),
      "utf8",
    );
    expect(blogAssemble).toMatch(/assemblePublishableNaverBlogFromEditorial|PUBLISHABLE_CHANNEL_CONTENT/);

    const bandAssemble = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/naverBandCopy/assemblePublishable.ts"),
      "utf8",
    );
    expect(bandAssemble).toMatch(/assemblePublishableNaverBandFromCopy|PUBLISHABLE_CHANNEL_CONTENT/);
  });
});
