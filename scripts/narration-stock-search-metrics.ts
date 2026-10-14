#!/usr/bin/env node
/**
 * Read-only roll-up of Narration stock-search records across contents. Writes nothing and calls no provider or Hermes.
 *
 *   npx tsx scripts/narration-stock-search-metrics.ts <packageRoot> [<packageRoot> ...]
 *   npx tsx scripts/narration-stock-search-metrics.ts --under /mnt/HDD2TB/marketing-assets/2026/10
 *
 * Counts are observations, not a ranking: unreviewed candidates are not failures and small samples stay small.
 */
import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const Module = require("module") as { _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string };
const original = Module._resolveFilename.bind(Module); const stub = require.resolve("./shims/server-only.js");
Module._resolveFilename = (request, parent, isMain, options) => request === "server-only" ? stub : original(request, parent, isMain, options);

const args = process.argv.slice(2);
function packagesUnder(directory: string, depth = 0): string[] {
  if (depth > 6 || !existsSync(directory)) return [];
  if (existsSync(join(directory, "context/narration/visual-sources"))) return [directory];
  return readdirSync(directory, { withFileTypes: true }).filter(e => e.isDirectory() && !["media", "node_modules", ".git"].includes(e.name)).flatMap(e => packagesUnder(join(directory, e.name), depth + 1));
}
const underIndex = args.indexOf("--under");
const roots = underIndex >= 0 ? packagesUnder(args[underIndex + 1] ?? "") : args;
if (!roots.length) { console.error("사용법: narration-stock-search-metrics.ts <packageRoot>... | --under <dir>"); process.exit(2); }
async function main() {
  const { aggregateStockSearchMetrics } = await import("@/lib/marketing/publishable/narrationVisualSources/metrics");
  const total = aggregateStockSearchMetrics(roots);
  console.log(JSON.stringify({ note: "관찰값입니다. 검토하지 않은 후보는 실패로 세지 않으며, 표본이 작은 전략을 최선으로 정하지 않습니다.", ...total }, null, 2));
}
void main();
