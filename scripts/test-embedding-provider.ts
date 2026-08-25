/**
 * Mini PC BGE-M3 embedding smoke test (server-side only).
 *
 * 실행:
 *   EMBEDDING_PROVIDER=mini_pc \
 *   EMBEDDING_BASE_URL=http://100.70.23.4:8100 \
 *   EMBEDDING_MODEL=BAAI/bge-m3 \
 *   EMBEDDING_DIMENSION=1024 \
 *   npx tsx scripts/test-embedding-provider.ts
 *
 * vector 전체와 EMBEDDING_API_TOKEN은 출력하지 않습니다.
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
  const { checkEmbeddingHealth, createEmbeddingProvider, HttpEmbeddingProvider, parseEmbeddingConfig } =
    await import("../src/lib/marketing/semantic/embeddingProvider");

  const config = parseEmbeddingConfig(process.env);
  if (config.kind === "none") {
    console.error("EMBEDDING_PROVIDER=none — Mini PC 호출을 건너뜁니다.");
    process.exit(1);
  }
  if (config.kind === "unsupported") {
    console.error("EMBEDDING_PROVIDER is not supported.");
    process.exit(1);
  }

  console.log("provider:", config.kind);
  console.log("baseUrl:", config.baseUrl);
  console.log("configured model:", config.model);
  console.log("configured dimension:", config.dimension);
  console.log("timeoutMs:", config.timeoutMs);
  console.log("auth:", config.apiToken ? "bearer" : "none");

  const health = await checkEmbeddingHealth(process.env);
  console.log("health ok:", health.ok);
  console.log("health model:", health.model);
  console.log("health dimension:", health.dimension);

  const provider = createEmbeddingProvider(process.env);
  if (!(provider instanceof HttpEmbeddingProvider)) {
    console.error("HttpEmbeddingProvider was not created.");
    process.exit(1);
  }

  const query = "부모님과 함께 가기 좋은 다낭 효도여행";
  const embedding = await provider.embed(query);
  console.log("embed query:", query);
  console.log("embed model:", provider.model);
  console.log("embed dimension:", provider.dimension);
  console.log("vector length:", embedding.length);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`embedding smoke test failed: ${message}`);
  process.exit(1);
});
