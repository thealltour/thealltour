/**
 * Content memory dry-run smoke test.
 *
 * Always dry-run. DB INSERT/UPDATE 없음. embedding 기본 호출 없음.
 *
 * 실행:
 *   npx tsx scripts/test-content-memory-ingestion.ts --content-id 실제-uuid
 *   npx tsx scripts/test-content-memory-ingestion.ts --product-id 실제-uuid --channel threads --lookback-days 30 --preview
 *
 * npx tsx는 Next.js env를 자동 로드하지 않으므로 .env / .env.local을 읽습니다.
 */

import { createRequire } from "node:module";
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

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    console.error("NEXT_PUBLIC_SUPABASE_URL is missing. Add it to .env.local (tsx does not load Next.js env).");
    process.exit(1);
  }
  const { parseContentMemoryCliArgs } = await import("../src/lib/marketing/memory/contentMemoryCli");
  const { runContentMemoryIngestion } = await import("../src/lib/marketing/memory/contentMemoryIngestionRun");
  const args = parseContentMemoryCliArgs(process.argv.slice(2));
  const outcome = await runContentMemoryIngestion({
    ...args,
    apply: false,
    preview: true,
  });
  if (outcome.result.failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`content memory dry-run failed: ${message}`);
  process.exit(1);
});
