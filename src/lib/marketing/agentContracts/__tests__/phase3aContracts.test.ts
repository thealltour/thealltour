import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MARKETING_AGENT_CONTRACT_DEBT,
  MARKETING_ROLE_VOCABULARY_SEPARATION,
  PHASE_3A_SEMANTIC_MIGRATED_PROFILE_IDS,
  assertMarketingAgentContractsHealthy,
  collectAllMarketingAgentContractIssues,
  collectArtifactDependencyIssues,
  getMarketingArtifactContract,
  listMarketingArtifactContracts,
  listMarketingAgentSemanticContracts,
  requireMarketingAgentSemanticContract,
  requireMarketingArtifactContract,
} from "@/lib/marketing/agentContracts";
import { getMarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/registry";
import { EDITORIAL_NARRATIVE_PLAN_CONTRACT } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { INSTAGRAM_CAROUSEL_PLAN_CONTRACT } from "@/lib/marketing/publishable/instagramEditorial/contracts";
import { INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT } from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import { SHARED_VISUAL_PLAN_CONTRACT } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import { MANUAL_ASTRA_HANDOFF_CONTRACT } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import { CARD_PRESENTATION_PLAN_CONTRACT } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import { INSTAGRAM_VISUAL_ROLES } from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import { INSTAGRAM_CAROUSEL_ROLES } from "@/lib/marketing/publishable/instagramEditorial/contracts";

describe("Phase 3A Marketing Agent Contracts", () => {
  it("A: semantic registry completeness for migrated agents", () => {
    const expected = [
      "editorial-narrative-planner",
      "instagram-carousel-planner",
      "instagram-card-copy-writer",
      "instagram-caption-writer",
      "instagram-visual-role-architect",
      "shared-visual-planner",
      "card-layout-director",
      "astra-handoff-writer",
      "threads-copy-writer",
      "naver-blog-structure-planner",
      "naver-blog-copy-writer",
    ];
    expect(PHASE_3A_SEMANTIC_MIGRATED_PROFILE_IDS.sort()).toEqual([...expected].sort());
  });

  it("B: semantic profile ↔ runtime registry linkage", () => {
    for (const id of PHASE_3A_SEMANTIC_MIGRATED_PROFILE_IDS) {
      expect(getMarketingHermesRuntimeContract(id)).toBeTruthy();
    }
  });

  it("C: artifact producer linkage", () => {
    expect(collectAllMarketingAgentContractIssues()).toEqual([]);
    expect(() => assertMarketingAgentContractsHealthy()).not.toThrow();
  });

  it("D: artifact dependency DAG is acyclic", () => {
    expect(collectArtifactDependencyIssues().filter((i) => i.code === "dependency_cycle")).toEqual(
      [],
    );
  });

  it("E: duplicate artifact id/path guard", () => {
    const ids = listMarketingArtifactContracts().map((a) => a.artifactId);
    expect(new Set(ids).size).toBe(ids.length);
    const paths = listMarketingArtifactContracts().map((a) => a.relativePath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("F: owns ∩ mustNotOwn overlap guard", () => {
    for (const s of listMarketingAgentSemanticContracts()) {
      const owns = new Set(s.authority.owns);
      for (const key of s.authority.mustNotOwn) {
        expect(owns.has(key), `${s.profileId} overlap ${key}`).toBe(false);
      }
    }
  });

  it("G: VRA / SVP / Carousel authority invariants", () => {
    const vra = requireMarketingAgentSemanticContract("instagram-visual-role-architect");
    expect(vra.authority.owns).toContain("instagram.visual.visualRole");
    expect(vra.authority.mustNotOwn).toEqual(
      expect.arrayContaining([
        "sharedVisual.masterOrchestration",
        "presentation.template",
        "astra.generationBrief",
        "instagram.carousel.editorialRole",
      ]),
    );

    const svp = requireMarketingAgentSemanticContract("shared-visual-planner");
    expect(svp.authority.reads).toContain("instagram.visualSemantics");
    expect(svp.authority.advisory).toContain("legacy.visualHints");
    expect(svp.authority.mustNotOwn).toContain("instagram.visual.visualRole");

    const carousel = requireMarketingAgentSemanticContract("instagram-carousel-planner");
    expect(carousel.authority.owns).toContain("instagram.carousel.editorialRole");
    expect(carousel.authority.mustNotOwn).toContain("instagram.visual.visualRole");
  });

  it("H: lifecycle parity fixtures match known chain FP sources", () => {
    expect(requireMarketingArtifactContract(EDITORIAL_NARRATIVE_PLAN_CONTRACT).lifecycle.fingerprintSources).toContain(
      "sourceCanonicalFingerprint",
    );
    expect(requireMarketingArtifactContract(INSTAGRAM_CAROUSEL_PLAN_CONTRACT).lifecycle.staleWhen).toMatch(
      /Narrative/i,
    );
    expect(
      requireMarketingArtifactContract(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT).lifecycle.fingerprintSources,
    ).toEqual(
      expect.arrayContaining(["sourceCarouselFingerprint", "sourceCardCopyFingerprint"]),
    );
    expect(requireMarketingArtifactContract(SHARED_VISUAL_PLAN_CONTRACT).lifecycle.staleWhen).toMatch(
      /VRA|bundle/i,
    );
    expect(requireMarketingArtifactContract(MANUAL_ASTRA_HANDOFF_CONTRACT).lifecycle.staleWhen).toMatch(
      /SVP/i,
    );
    expect(requireMarketingArtifactContract(CARD_PRESENTATION_PLAN_CONTRACT).lifecycle.staleWhen).toMatch(
      /IG|instagram|visual/i,
    );
  });

  it("I: failurePolicy metadata fixtures reflect current facts", () => {
    expect(
      requireMarketingArtifactContract(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT).failurePolicy
        ?.materializeInRepairLoop,
    ).toBe(true);
    expect(
      requireMarketingArtifactContract(INSTAGRAM_CAROUSEL_PLAN_CONTRACT).failurePolicy
        ?.materializeInRepairLoop,
    ).toBe(false);
    expect(
      requireMarketingArtifactContract(SHARED_VISUAL_PLAN_CONTRACT).failurePolicy?.onGenerateFail,
    ).toBe("preserve_previous");
    expect(
      requireMarketingArtifactContract(MANUAL_ASTRA_HANDOFF_CONTRACT).failurePolicy?.onGenerateFail,
    ).toBe("preserve_previous");
    expect(
      requireMarketingArtifactContract(CARD_PRESENTATION_PLAN_CONTRACT).failurePolicy?.onGenerateFail,
    ).toBe("deterministic_fallback");
  });

  it("J: legacy exclusion/debt is explicit", () => {
    expect(MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.kind === "legacy_channel_editor")).toBe(true);
    expect(MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.id === "legacy-visual-hints")).toBe(true);
    expect(PHASE_3A_SEMANTIC_MIGRATED_PROFILE_IDS.every((id) => !id.startsWith("channel-editor-"))).toBe(
      true,
    );
  });

  it("vocabulary separation: carousel editorialRole ≠ visualRole enums", () => {
    expect(MARKETING_ROLE_VOCABULARY_SEPARATION.carouselEditorialRole.key).not.toBe(
      MARKETING_ROLE_VOCABULARY_SEPARATION.visualRole.key,
    );
    const carouselOnly = INSTAGRAM_CAROUSEL_ROLES.filter((r) => !(INSTAGRAM_VISUAL_ROLES as readonly string[]).includes(r));
    expect(carouselOnly.length).toBeGreaterThan(0);
    expect(carouselOnly).toEqual(expect.arrayContaining(["hook_cover", "reframe", "closing"]));
  });

  it("lookup APIs throw on unknown ids", () => {
    expect(() => requireMarketingAgentSemanticContract("not-registered")).toThrow(/semantic contract/i);
    expect(() => requireMarketingArtifactContract("not-an-artifact")).toThrow(/artifact contract/i);
    expect(getMarketingArtifactContract(SHARED_VISUAL_PLAN_CONTRACT)?.relativePath).toBe(
      "context/shared-visual-plan.json",
    );
  });

  it("SOUL parity: critical VRA / SVP / Carousel invariants present", () => {
    const root = process.cwd();
    const vraSoul = readFileSync(
      join(root, "src/lib/marketing/publishable/instagramVisualRole/hermesIdentity.ts"),
      "utf8",
    );
    expect(vraSoul).toMatch(/MUST NOT decide/i);
    expect(vraSoul).toMatch(/master visualId/i);
    expect(vraSoul).toMatch(/different vocabularies/i);
    expect(vraSoul).toMatch(/NEVER copy carousel/);

    const svpSoul = readFileSync(
      join(root, "src/lib/marketing/publishable/visualOrchestration/hermesIdentity.ts"),
      "utf8",
    );
    expect(svpSoul).toMatch(/VRA wins/i);
    expect(svpSoul).toMatch(/advisory/i);
    expect(svpSoul).toMatch(/redesign VRA/i);

    const carouselSoul = readFileSync(
      join(root, "src/lib/marketing/publishable/instagramEditorial/hermesIdentity.ts"),
      "utf8",
    );
    expect(carouselSoul).toMatch(/visualRole/i);
    expect(carouselSoul).toMatch(/MUST NOT decide/i);
  });

  it("intended visual DAG edges exist", () => {
    const vra = requireMarketingArtifactContract(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT);
    expect(vra.dependsOn).toEqual(
      expect.arrayContaining([INSTAGRAM_CAROUSEL_PLAN_CONTRACT]),
    );
    const svp = requireMarketingArtifactContract(SHARED_VISUAL_PLAN_CONTRACT);
    expect(svp.dependsOn).toContain(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT);
    const astra = requireMarketingArtifactContract(MANUAL_ASTRA_HANDOFF_CONTRACT);
    expect(astra.dependsOn).toEqual([SHARED_VISUAL_PLAN_CONTRACT]);
  });
});
