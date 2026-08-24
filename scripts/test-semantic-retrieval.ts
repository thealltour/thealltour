/**
 * Mini PC embedding + Supabase match_ai_memory smoke test.
 *
 * 실행:
 *   EMBEDDING_PROVIDER=mini_pc \
 *   EMBEDDING_BASE_URL=http://100.70.23.4:8100 \
 *   EMBEDDING_MODEL=BAAI/bge-m3 \
 *   EMBEDDING_DIMENSION=1024 \
 *   npx tsx scripts/test-semantic-retrieval.ts
 *
 * INSERT/UPDATE/DELETE 없음. vector 전체와 memory 원문은 출력하지 않습니다.
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
  const { checkEmbeddingHealth, parseEmbeddingConfig } = await import(
    "../src/lib/marketing/semantic/embeddingProvider"
  );
  const { semanticRetrieve } = await import("../src/lib/marketing/semantic/semanticRetrieve");
  const { isVectorMemoryRepositoryConfigured } = await import(
    "../src/lib/marketing/semantic/vectorMemoryRepository"
  );

  const config = parseEmbeddingConfig(process.env);
  if (config.kind === "none" || config.kind === "unsupported") {
    console.error("EMBEDDING_PROVIDER must be mini_pc for this smoke test.");
    process.exit(1);
  }

  console.log("provider:", config.kind);
  console.log("configured model:", config.model);
  console.log("configured dimension:", config.dimension);
  console.log("supabase repository:", isVectorMemoryRepositoryConfigured() ? "configured" : "missing");

  const health = await checkEmbeddingHealth(process.env);
  console.log("health ok:", health.ok);
  console.log("health model:", health.model);
  console.log("health dimension:", health.dimension);

  const query = "부모님과 함께 가기 좋은 다낭 효도여행";
  const result = await semanticRetrieve({ query, limit: 5, minScore: 0 });
  console.log("embed query:", query);
  console.log("semantic status:", result.status);
  if (result.reason) console.log("semantic reason:", result.reason);
  console.log("semantic model:", result.model ?? config.model);
  console.log("match count:", result.matches.length);
  if (result.status === "ok") {
    console.log("zero matches is success:", result.matches.length === 0);
  }
  if (result.status === "failed") {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`semantic retrieval smoke test failed: ${message}`);
  process.exit(1);
});
