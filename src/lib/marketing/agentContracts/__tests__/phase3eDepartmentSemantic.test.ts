import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MARKETING_AGENT_CONTRACT_DEBT,
  PHASE_3A_SEMANTIC_MIGRATED_PROFILE_IDS,
  PHASE_3B_WIRED_ARTIFACT_IDS,
  PHASE_3C_WIRED_ARTIFACT_IDS,
  PHASE_3D_WIRED_ARTIFACT_IDS,
  PHASE_3E_DEPARTMENT_PROFILE_IDS,
  assertMarketingAgentContractsHealthy,
  assertSemanticCompletenessHealthy,
  buildSemanticCompletenessReport,
  collectAuthoritySanityIssues,
  requireMarketingAgentSemanticContract,
} from "@/lib/marketing/agentContracts";
import { getMarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/registry";

describe("Phase 3E department semantic contracts", () => {
  it("A: four department semantic contracts exist", () => {
    for (const id of PHASE_3E_DEPARTMENT_PROFILE_IDS) {
      expect(requireMarketingAgentSemanticContract(id).profileId).toBe(id);
    }
  });

  it("B: runtime registry linkage (aliases unchanged)", () => {
    const expectedAlias: Record<(typeof PHASE_3E_DEPARTMENT_PROFILE_IDS)[number], string> = {
      "content-strategist": "thealltour/content-strategist",
      "marketing-manager": "thealltour/marketing-manager",
      "governance-auditor": "thealltour/governance-auditor",
      "performance-analyst": "thealltour/performance-analyst",
    };
    for (const id of PHASE_3E_DEPARTMENT_PROFILE_IDS) {
      const runtime = getMarketingHermesRuntimeContract(id);
      expect(runtime).toBeTruthy();
      expect(runtime!.kind).toBe("department");
      expect(runtime!.runtime.modelAlias).toBe(expectedAlias[id]);
    }
  });

  it("C: owns ∩ mustNotOwn = empty", () => {
    expect(collectAuthoritySanityIssues()).toEqual([]);
    for (const id of PHASE_3E_DEPARTMENT_PROFILE_IDS) {
      const c = requireMarketingAgentSemanticContract(id);
      const owns = new Set(c.authority.owns);
      for (const key of c.authority.mustNotOwn) {
        expect(owns.has(key)).toBe(false);
      }
    }
  });

  it("D: no artifactId output links (docs-only durable mapping)", () => {
    for (const id of PHASE_3E_DEPARTMENT_PROFILE_IDS) {
      const c = requireMarketingAgentSemanticContract(id);
      expect(c.output?.artifactId).toBeUndefined();
      expect(c.docs?.notes?.some((n) => /docs-only|Durable/i.test(n))).toBe(true);
    }
  });

  it("E: department/specialist authority overlap critical guards", () => {
    const cs = requireMarketingAgentSemanticContract("content-strategist");
    expect(cs.authority.mustNotOwn).toEqual(
      expect.arrayContaining([
        "instagram.cardCopy",
        "instagram.visualSemantics",
        "sharedVisual.masterOrchestration",
        "threads.copy",
      ]),
    );
    expect(cs.authority.owns).toEqual(
      expect.arrayContaining(["contentStrategy.proposition", "contentStrategy.contentPlan"]),
    );

    const mm = requireMarketingAgentSemanticContract("marketing-manager");
    expect(mm.authority.owns).toEqual(
      expect.arrayContaining([
        "marketingManagement.orchestration",
        "marketingManagement.agendaSelection",
      ]),
    );
    expect(mm.authority.mustNotOwn).toEqual(
      expect.arrayContaining([
        "instagram.cardCopy",
        "presentation.template",
        "astra.generationBrief",
        "governance.verdict",
      ]),
    );

    const ga = requireMarketingAgentSemanticContract("governance-auditor");
    expect(ga.authority.owns).toEqual(
      expect.arrayContaining(["governance.assessment", "governance.verdict"]),
    );
    expect(ga.authority.mustNotOwn).toEqual(
      expect.arrayContaining([
        "contentStrategy.proposition",
        "instagram.cardCopy",
        "threads.copy",
      ]),
    );

    const pa = requireMarketingAgentSemanticContract("performance-analyst");
    expect(pa.authority.owns).toEqual(
      expect.arrayContaining(["performance.analysis", "performance.recommendation"]),
    );
    expect(pa.authority.mustNotOwn).toEqual(
      expect.arrayContaining([
        "contentStrategy.contentPlan",
        "governance.verdict",
        "publishable.bundle",
      ]),
    );
  });

  it("F: SOUL / contract / runtime prompt parity (critical boundaries)", () => {
    const root = process.cwd();

    const csSoul = readFileSync(
      join(root, "docs/hermes/marketing/prompts/content-strategist.md"),
      "utf8",
    );
    expect(csSoul).toMatch(/ContentProposition|contentPlan/i);
    expect(csSoul).toMatch(/채널별 최종 publishable|Channel Composer/i);
    expect(csSoul).toMatch(/Does not own|소유하지 않|agenda 선정/i);

    const csContract = readFileSync(
      join(root, "src/lib/marketing/bot/contracts/content-strategist.md"),
      "utf8",
    );
    expect(csContract).toMatch(/content-proposition-v1/);
    expect(csContract).toMatch(/Channel Composers/);

    const mmSoul = readFileSync(
      join(root, "docs/hermes/marketing/prompts/marketing-manager.md"),
      "utf8",
    );
    expect(mmSoul).toMatch(/run_department_orchestration|오케스트/i);
    expect(mmSoul).toMatch(/publish|게시/i);

    const gaSoul = readFileSync(
      join(root, "docs/hermes/marketing/prompts/governance-auditor.md"),
      "utf8",
    );
    expect(gaSoul).toMatch(/ALLOW|REVIEW|BLOCK/);
    expect(gaSoul).toMatch(/다듬지|rewrite|대신/i);

    const gaContract = readFileSync(
      join(root, "src/lib/marketing/bot/contracts/governance-auditor.md"),
      "utf8",
    );
    expect(gaContract).toMatch(/대신 고쳐주는 역할이 아니다|독립 검수/);

    const paSoul = readFileSync(
      join(root, "docs/hermes/marketing/prompts/performance-analyst.md"),
      "utf8",
    );
    expect(paSoul).toMatch(/get_performance_evidence|성과/);
    expect(paSoul).toMatch(/게시|승인/i);

    // Runtime shaping still owns Content Strategist validation
    const specialists = readFileSync(
      join(root, "src/lib/marketing/cron/marketingPlanSpecialists.ts"),
      "utf8",
    );
    expect(specialists).toMatch(/content-proposition-v1/);
    expect(specialists).toMatch(/ContentPlan/);
  });

  it("G: semantic completeness — no silent gaps", () => {
    assertSemanticCompletenessHealthy();
    const report = buildSemanticCompletenessReport();
    expect(report.missing).toEqual([]);
    for (const id of PHASE_3E_DEPARTMENT_PROFILE_IDS) {
      expect(report.registered).toContain(id);
    }
    expect(report.intentionallyExcluded.every((id) => id.startsWith("channel-editor-"))).toBe(
      true,
    );
    expect(report.intentionallyExcluded.length).toBeGreaterThanOrEqual(6);
  });

  it("H: Phase 3A–3D regression + debt update", () => {
    expect(() => assertMarketingAgentContractsHealthy()).not.toThrow();
    expect(MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.id === "department-bots")).toBe(false);
    expect(MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.id === "department-profile-env-legacy")).toBe(
      true,
    );
    expect(
      MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.id === "department-durable-outputs-unregistered"),
    ).toBe(true);
    expect(MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.id === "spike-alias-usage")).toBe(true);
    expect(
      MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.id === "specialist-role-routing-not-yet-tuned"),
    ).toBe(true);
    expect(MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.id === "layout-hermes-production-ambiguity")).toBe(
      true,
    );
    expect(
      MARKETING_AGENT_CONTRACT_DEBT.some((d) => d.id === "materialize-in-repair-loop-divergence"),
    ).toBe(true);

    for (const id of PHASE_3B_WIRED_ARTIFACT_IDS) {
      expect(id).toBeTruthy();
    }
    expect(PHASE_3C_WIRED_ARTIFACT_IDS.length).toBe(5);
    expect(PHASE_3D_WIRED_ARTIFACT_IDS.length).toBe(4);
    expect(PHASE_3A_SEMANTIC_MIGRATED_PROFILE_IDS).toEqual(
      expect.arrayContaining([...PHASE_3E_DEPARTMENT_PROFILE_IDS]),
    );
  });
});
