/**
 * Mini PC embedding + Supabase match_ai_memory smoke test.
 *
 * 실행:
 *   npx tsx scripts/test-semantic-retrieval.ts
 *   npx tsx scripts/test-semantic-retrieval.ts "검색어"
 *
 * .env / .env.local을 로드합니다. INSERT/UPDATE/DELETE 없음.
 * vector 전체와 memory 원문은 출력하지 않습니다.
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
  const { checkEmbeddingHealth, parseEmbeddingConfig } = await import(
    "../src/lib/marketing/semantic/embeddingProvider"
  );
  const { semanticRetrieve } = await import("../src/lib/marketing/semantic/semanticRetrieve");
  const { isVectorMemoryRepositoryConfigured } = await import(
    "../src/lib/marketing/semantic/vectorMemoryRepository"
  );

  const config = parseEmbeddingConfig(process.env);
  if (config.kind !== "mini_pc" && config.kind !== "http") {
    console.error("EMBEDDING_PROVIDER must be mini_pc (or http) in .env.local for this smoke test.");
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

  const query = process.argv.slice(2).join(" ").trim() || "부모님과 함께 가기 좋은 다낭 효도여행";
  const result = await semanticRetrieve({ query, limit: 5, minScore: 0 });
  console.log("embed query:", query);
  console.log("semantic status:", result.status);
  if (result.reason) console.log("semantic reason:", result.reason);
  console.log("semantic model:", result.model ?? config.model);
  console.log("match count:", result.matches.length);
  for (const match of result.matches) {
    console.log(
      [
        `score=${match.score.toFixed(3)}`,
        `type=${match.memory.memoryType}`,
        `source=${match.memory.sourceType ?? "-"}:${match.memory.sourceId ?? "-"}`,
        `title=${match.memory.title ?? "(none)"}`,
      ].join(" "),
    );
  }
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
