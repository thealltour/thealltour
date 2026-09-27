#!/usr/bin/env npx tsx
/**
 * Cross-fixture regression harness CLI (infrastructure only).
 *
 * Usage:
 *   npx tsx scripts/cross-fixture-regression.ts inventory
 *   npx tsx scripts/cross-fixture-regression.ts verify [--max-age-ms N]
 *   npx tsx scripts/cross-fixture-regression.ts report [--max-age-ms N]
 *   npx tsx scripts/cross-fixture-regression.ts regenerate <fixtureId>
 *   npx tsx scripts/cross-fixture-regression.ts regenerate-all
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  describeManifestCoverage,
  runCrossFixtureHarness,
  type HarnessMode,
} from "@/lib/marketing/publishable/crossFixtureRegression";

function parseArgs(argv: string[]): {
  mode: HarnessMode;
  fixtureId?: string;
  maxAgeMs?: number;
  outPath?: string;
} {
  const mode = (argv[0] ?? "report") as HarnessMode;
  const allowed: HarnessMode[] = [
    "inventory",
    "verify",
    "report",
    "regenerate",
    "regenerate-all",
  ];
  if (!allowed.includes(mode)) {
    throw new Error(`Unknown mode: ${mode}. Expected one of ${allowed.join(", ")}`);
  }

  let fixtureId: string | undefined;
  let maxAgeMs: number | undefined;
  let outPath: string | undefined;

  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--max-age-ms") {
      maxAgeMs = Number(argv[++i]);
      continue;
    }
    if (a === "--out") {
      outPath = argv[++i];
      continue;
    }
    if (!a.startsWith("-") && mode === "regenerate") {
      fixtureId = a;
      continue;
    }
    throw new Error(`Unexpected argument: ${a}`);
  }

  return { mode, fixtureId, maxAgeMs, outPath };
}

async function main() {
  const { mode, fixtureId, maxAgeMs, outPath } = parseArgs(process.argv.slice(2));
  const coverage = describeManifestCoverage();
  const report = await runCrossFixtureHarness({ mode, fixtureId, maxAgeMs });

  const defaultOut = path.join(
    "artifacts",
    "cross-fixture-regression",
    `report-${report.generatedAt.replace(/[:.]/g, "-")}.md`,
  );
  const target = outPath ?? defaultOut;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, report.markdown, "utf8");

  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        generatedAt: report.generatedAt,
        coverage,
        fixtureCount: report.fixtures.length,
        overalls: report.fixtures.map((f) => ({
          fixtureId: f.fixtureId,
          overall: f.overall,
          eligible: f.eligible,
        })),
        reportPath: target,
      },
      null,
      2,
    ),
  );
  console.log("\n--- markdown preview (first 80 lines) ---\n");
  console.log(report.markdown.split("\n").slice(0, 80).join("\n"));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
