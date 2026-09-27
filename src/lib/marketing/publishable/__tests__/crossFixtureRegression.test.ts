import { describe, expect, it } from "vitest";

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import {
  assertProductionFixtureEligible,
  contentPassRequiresExactProse,
  DAO_FIXTURE,
  FUTURE_FIXTURE_SLOTS,
  getFixtureById,
  listProductionBackedFixtures,
  listUnpopulatedSlots,
  PHU_QUOC_DECISION_FIXTURE,
  preserveNonPassVerdict,
  rejectDraftForProductionFixture,
  renderCrossFixtureMarkdownReport,
  verifyChannelArtifact,
} from "@/lib/marketing/publishable/crossFixtureRegression";
import type {
  CrossFixtureVerdict,
  ProductionBackedFixture,
} from "@/lib/marketing/publishable/crossFixtureRegression/types";

function draftCanonical(overrides?: Partial<CanonicalMarketingAsset>): CanonicalMarketingAsset {
  return {
    assetId: "cma_draft_fixture_test",
    version: 1,
    status: "draft",
    titleKo: "draft",
    ...(overrides as object),
  } as CanonicalMarketingAsset;
}

function approvedCanonical(
  overrides?: Partial<CanonicalMarketingAsset>,
): CanonicalMarketingAsset {
  return {
    assetId: DAO_FIXTURE.assetId,
    version: 2,
    approvedVersion: 2,
    status: "approved",
    titleKo: DAO_FIXTURE.titleKo,
    ...(overrides as object),
  } as CanonicalMarketingAsset;
}

describe("cross-fixture regression policy", () => {
  it("registers only approved production fixtures (Dao + Phu Quoc)", () => {
    const production = listProductionBackedFixtures();
    expect(production.map((f) => f.fixtureId).sort()).toEqual(
      ["dao-northern-border-contrast", "phuquoc-hotel-booking-vs-wait"].sort(),
    );
    for (const f of production) {
      expect(f.backing).toBe("production_backed");
      expect(f.canonicalStatusRequired).toBe("approved");
      expect(f.role).toBeTruthy();
      expect(Object.keys(f.expectedBehaviors).length).toBeGreaterThan(0);
    }
  });

  it("keeps future categories UNPOPULATED", () => {
    const slots = listUnpopulatedSlots();
    expect(slots.length).toBe(FUTURE_FIXTURE_SLOTS.length);
    expect(slots.every((s) => s.backing === "unpopulated_slot")).toBe(true);
    expect(slots.map((s) => s.role).sort()).toEqual(
      [
        "practical_informational",
        "commercial_conversion",
        "supported_region_geo",
        "strong_dramatic_hook",
      ].sort(),
    );
  });

  it("requires fixture role metadata on production entries", () => {
    for (const f of listProductionBackedFixtures()) {
      expect(f.role).toBeTruthy();
      expect(f.channelsToTest.length).toBeGreaterThan(0);
    }
  });

  it("rejects draft Canonical for production-backed fixture", async () => {
    expect(rejectDraftForProductionFixture("draft")).toBe(true);
    expect(rejectDraftForProductionFixture("approved")).toBe(false);

    const result = await assertProductionFixtureEligible(DAO_FIXTURE, {
      canonicalOverride: draftCanonical({ assetId: DAO_FIXTURE.assetId }),
    });
    expect(result.ok).toBe(false);
    expect(result.blockers.some((b) => /draft/i.test(b))).toBe(true);
  });

  it("accepts approved Canonical matching assetId (eligibility only)", async () => {
    const result = await assertProductionFixtureEligible(DAO_FIXTURE, {
      canonicalOverride: approvedCanonical(),
    });
    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("does not treat unpopulated slots as production-backed", () => {
    const slot = getFixtureById("slot-commercial-conversion");
    expect(slot?.backing).toBe("unpopulated_slot");
    expect(listProductionBackedFixtures().some((f) => f.fixtureId === slot?.fixtureId)).toBe(
      false,
    );
  });

  it("exact prose is not required for content PASS", () => {
    expect(contentPassRequiresExactProse()).toBe(false);
  });

  it("preserves FAIL / BLOCKED / UNTESTED states", () => {
    const states: CrossFixtureVerdict[] = ["FAIL", "BLOCKED", "UNTESTED", "PASS", "PASS_WITH_MINOR"];
    for (const s of states) {
      expect(preserveNonPassVerdict(s)).toBe(s);
    }
  });

  it("reports missing artifact as FAIL (no content PASS)", async () => {
    const check = await verifyChannelArtifact("/tmp/cross-fixture-missing-pkg-xyz", {
      channel: "threads",
      relativePath: "context/threads-post.json",
      requiredKeys: ["posts"],
    });
    expect(check.freshness).toBe("FAIL");
    expect(check.materialize).toBe("FAIL");
    expect(check.style).toBe("BLOCKED");
    expect(check.overall).toBe("FAIL");
    expect(check.blockers.some((b) => /missing artifact/i.test(b))).toBe(true);
  });

  it("reports stale artifact as freshness FAIL and blocks content PASS", async () => {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const os = await import("node:os");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cross-fixture-stale-"));
    const ctx = path.join(dir, "context");
    await fs.mkdir(ctx, { recursive: true });
    await fs.writeFile(
      path.join(ctx, "threads-post.json"),
      JSON.stringify({
        generatedAt: "2020-01-01T00:00:00.000Z",
        posts: [{ text: "ok" }],
        publishableSuccess: true,
      }),
      "utf8",
    );

    const check = await verifyChannelArtifact(dir, {
      channel: "threads",
      relativePath: "context/threads-post.json",
      requiredKeys: ["posts"],
    }, { maxAgeMs: 60_000 });

    expect(check.freshness).toBe("FAIL");
    expect(check.style).toBe("BLOCKED");
    expect(check.archetypeFit).toBe("BLOCKED");
    expect(check.evidence).toBe("BLOCKED");
    expect(check.blockers.some((b) => /stale artifact/i.test(b))).toBe(true);
  });

  it("Dao fixture encodes discovery expectations (not banned-word policy)", () => {
    expect(DAO_FIXTURE.role).toBe("discovery_contrast");
    expect(DAO_FIXTURE.expectedBehaviors.informationalCtaOptional).toBe(true);
    expect(DAO_FIXTURE.prohibitedRegressions.forcedDecisionCriterionOnDiscovery).toBe(true);
    expect(DAO_FIXTURE.prohibitedRegressions.forcedPerspectiveAwarenessLesson).toBe(true);
  });

  it("Phu Quoc fixture encodes decision expectations (topic CTA allowed)", () => {
    expect(PHU_QUOC_DECISION_FIXTURE.role).toBe("decision_comparison");
    expect(PHU_QUOC_DECISION_FIXTURE.expectedBehaviors.preservesSupportedDecisionCriteria).toBe(
      true,
    );
    expect(PHU_QUOC_DECISION_FIXTURE.expectedBehaviors.decisionTopicNotMistakenForCta).toBe(
      true,
    );
    expect(
      PHU_QUOC_DECISION_FIXTURE.expectedBehaviors.unauthorizedImperativeCtaStillBlocked,
    ).toBe(true);
  });

  it("report renderer keeps dimensions separate", () => {
    const md = renderCrossFixtureMarkdownReport({
      generatedAt: "2026-09-27T00:00:00.000Z",
      mode: "report",
      fixtures: [
        {
          fixtureId: DAO_FIXTURE.fixtureId,
          eligible: true,
          eligibilityBlockers: [],
          overall: "PASS_WITH_MINOR",
          channels: [
            {
              channel: "band",
              freshness: "PASS",
              materialize: "PASS",
              style: "UNTESTED",
              archetypeFit: "UNTESTED",
              evidence: "UNTESTED",
              overall: "UNTESTED",
              generatedAt: "2026-09-26T18:00:00.000Z",
              modelProfile: null,
              publishableSuccess: true,
              artifactPath: "/tmp/band.json",
              notes: [],
              blockers: [],
            },
          ],
        },
      ],
      productionFixtures: [DAO_FIXTURE] as ProductionBackedFixture[],
    });
    expect(md).toContain("Fixture summary");
    expect(md).toContain("Channel detail");
    expect(md).toContain("Freshness");
    expect(md).toContain("Archetype Fit");
    expect(md).not.toMatch(/must never appear/);
  });
});
