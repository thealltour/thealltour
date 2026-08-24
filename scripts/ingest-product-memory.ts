/**
 * Product memory ingestion.
 *
 * Default is dry-run (no DB write, no embedding).
 *
 * 실행:
 *   npx tsx scripts/ingest-product-memory.ts --product-id <uuid>
 *   npx tsx scripts/ingest-product-memory.ts --product-id <uuid> --preview
 *   npx tsx scripts/ingest-product-memory.ts --product-id <uuid> --apply
 *
 * --apply 없이 production ai_memory에 INSERT/UPDATE 하지 않습니다.
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
  const outcome = await runProductMemoryIngestion(args);
  if (outcome.result.failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`product memory ingestion failed: ${message}`);
  process.exit(1);
});
