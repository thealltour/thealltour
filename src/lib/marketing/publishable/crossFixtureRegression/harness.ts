/**
 * Cross-fixture regression harness entrypoints.
 * Modes: inventory | verify | report | regenerate | regenerate-all
 *
 * regenerate* does NOT alter production writer code. Live LLM regeneration remains
 * an operator step via existing package pipelines; this harness only verifies eligibility
 * and documents the required operator action.
 */

import {
  CROSS_FIXTURE_MANIFEST,
  getFixtureById,
  listProductionBackedFixtures,
  listUnpopulatedSlots,
} from "@/lib/marketing/publishable/crossFixtureRegression/fixtureManifest";
import {
  buildRegressionInventory,
  formatInventoryMarkdown,
} from "@/lib/marketing/publishable/crossFixtureRegression/inventory";
import { renderCrossFixtureMarkdownReport } from "@/lib/marketing/publishable/crossFixtureRegression/report";
import type {
  CrossFixtureRunReport,
  FixtureVerifyResult,
} from "@/lib/marketing/publishable/crossFixtureRegression/types";
import { verifyProductionFixture } from "@/lib/marketing/publishable/crossFixtureRegression/verify";

export type HarnessMode =
  | "inventory"
  | "verify"
  | "report"
  | "regenerate"
  | "regenerate-all";

export type RunHarnessOptions = {
  mode: HarnessMode;
  fixtureId?: string;
  /** Optional freshness gate for verify/report. */
  maxAgeMs?: number;
};

function regenerateOperatorNote(fixtureId: string): FixtureVerifyResult {
  return {
    fixtureId,
    eligible: true,
    eligibilityBlockers: [],
    channels: [],
    overall: "UNTESTED",
  };
}

export async function runCrossFixtureHarness(
  options: RunHarnessOptions,
): Promise<CrossFixtureRunReport> {
  const generatedAt = new Date().toISOString();
  const inventory = buildRegressionInventory();
  const inventoryMarkdown = formatInventoryMarkdown(inventory);
  const inventoryNotes = inventory.flatMap((s) => s.items.map((i) => `[${s.title}] ${i}`));

  if (options.mode === "inventory") {
    return {
      contract: "cross-fixture-regression-report-v1",
      generatedAt,
      mode: "inventory",
      inventoryNotes,
      fixtures: [],
      markdown: inventoryMarkdown,
    };
  }

  if (options.mode === "regenerate" || options.mode === "regenerate-all") {
    const targets =
      options.mode === "regenerate-all"
        ? listProductionBackedFixtures()
        : (() => {
            if (!options.fixtureId) {
              throw new Error("regenerate requires fixtureId");
            }
            const entry = getFixtureById(options.fixtureId);
            if (!entry || entry.backing !== "production_backed") {
              throw new Error(
                `fixture ${options.fixtureId} is not an eligible production-backed fixture`,
              );
            }
            return [entry];
          })();

    const fixtures = targets.map((t) => regenerateOperatorNote(t.fixtureId));
    const md = [
      "# Cross-fixture regenerate (operator)",
      "",
      "Harness v1 does not invoke production writers.",
      "Use existing package regenerate / ensurePublishableContent flows, then re-run `verify` / `report`.",
      "",
      ...targets.map(
        (t) =>
          `- ${t.fixtureId}: packageRoot=${t.packageRoot} assetId=${t.assetId} channels=${t.channelsToTest.join(",")}`,
      ),
      "",
      "After regeneration, run verify so stale reuse cannot receive content PASS.",
      "",
    ].join("\n");

    return {
      contract: "cross-fixture-regression-report-v1",
      generatedAt,
      mode: options.mode,
      inventoryNotes,
      fixtures,
      markdown: md,
    };
  }

  // verify | report
  const production = listProductionBackedFixtures();
  const fixtures: FixtureVerifyResult[] = [];
  for (const fixture of production) {
    fixtures.push(
      await verifyProductionFixture(fixture, { maxAgeMs: options.maxAgeMs }),
    );
  }

  const markdown = renderCrossFixtureMarkdownReport({
    generatedAt,
    mode: options.mode,
    inventoryMarkdown: options.mode === "report" ? inventoryMarkdown : undefined,
    fixtures,
    productionFixtures: production,
  });

  return {
    contract: "cross-fixture-regression-report-v1",
    generatedAt,
    mode: options.mode,
    inventoryNotes,
    fixtures,
    markdown,
  };
}

export function describeManifestCoverage(): {
  productionBacked: number;
  unpopulatedSlots: number;
  totalEntries: number;
} {
  return {
    productionBacked: listProductionBackedFixtures().length,
    unpopulatedSlots: listUnpopulatedSlots().length,
    totalEntries: CROSS_FIXTURE_MANIFEST.length,
  };
}
