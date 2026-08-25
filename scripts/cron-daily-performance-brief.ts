/**
 * Cron script: Daily Performance Brief (task-only, no SNS publish).
 *
 * Writes a single latest JSON artifact (atomic) and prints markdown for Hermes local delivery.
 *
 *   npx tsx scripts/cron-daily-performance-brief.ts
 *   npx tsx scripts/cron-daily-performance-brief.ts --product-id <uuid> --channel threads
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "./loadLocalEnv";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
};
const originalResolve = Module._resolveFilename.bind(Module);
const serverOnlyStub = require.resolve("./shims/server-only.js");
Module._resolveFilename = function resolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === "server-only") return serverOnlyStub;
  return originalResolve(request, parent, isMain, options);
};

loadLocalEnv();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";

function argValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  return argv[idx + 1];
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    console.error("NEXT_PUBLIC_SUPABASE_URL is missing. Add it to .env.local.");
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  const productId = argValue(argv, "--product-id") ?? process.env.MARKETING_CRON_PRODUCT_ID ?? DEFAULT_PRODUCT;
  const channel = argValue(argv, "--channel") ?? process.env.MARKETING_CRON_CHANNEL ?? "threads";

  const { buildDailyPerformanceBrief } = await import("../src/lib/marketing/cron/buildDailyPerformanceBrief");
  const {
    defaultPerformanceBriefAbsolutePath,
    formatDailyPerformanceBriefMarkdown,
    writeLatestPerformanceBrief,
  } = await import("../src/lib/marketing/cron/performanceBriefArtifact");

  const brief = await buildDailyPerformanceBrief({ productId, channel });
  const path = defaultPerformanceBriefAbsolutePath(ROOT);
  writeLatestPerformanceBrief(brief, path);

  console.log(formatDailyPerformanceBriefMarkdown(brief));
  console.log(`artifact: ${path}`);
  console.log(`dataAvailability: ${brief.dataAvailability}`);
  console.log("sns_side_effect: 0");
  console.log("db_write: none (artifact file only; no ai_memory INSERT)");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`daily performance brief failed: ${message}`);
  process.exit(1);
});
