/**
 * Product memory dry-run smoke test.
 *
 * Always dry-run. DB INSERT/UPDATE 없음. embedding 기본 호출 없음.
 *
 * 실행:
 *   npx tsx scripts/test-product-memory-ingestion.ts --product-id <uuid>
 *   npx tsx scripts/test-product-memory-ingestion.ts --product-id <uuid> --preview
 */

import { createRequire } from "node:module";

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

async function main() {
  const { parseProductMemoryCliArgs } = await import("../src/lib/marketing/memory/productMemoryCli");
  const { runProductMemoryIngestion } = await import("../src/lib/marketing/memory/productMemoryIngestionRun");
  const args = parseProductMemoryCliArgs(process.argv.slice(2));
  const outcome = await runProductMemoryIngestion({ ...args, apply: false });
  if (outcome.result.failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`product memory dry-run failed: ${message}`);
  process.exit(1);
});
