#!/usr/bin/env npx tsx
/**
 * STEP E-2 — controlled single-entity semantic indexing (manual only).
 *
 * Usage:
 *   npx tsx scripts/index-marketing-semantic-entity.ts --entity-type research_brief --entity-id <id>
 *   npx tsx scripts/index-marketing-semantic-entity.ts --entity-type agenda_candidate --entity-id <id> --dry-run
 *
 * Safety:
 * - Requires explicit --entity-type and --entity-id (no "index all")
 * - Never prints tokens or embedding vectors
 * - Does not auto-apply migrations
 * - Refuses silent in-memory fallback when durable store is required
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

type CliArgs = {
  entityType: string | null;
  entityId: string | null;
  dryRun: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    entityType: null,
    entityId: null,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--entity-type") {
      args.entityType = argv[++i]?.trim() ?? null;
      continue;
    }
    if (token === "--entity-id") {
      args.entityId = argv[++i]?.trim() ?? null;
      continue;
    }
    throw new Error(`unknown argument: ${token}`);
  }
  return args;
}

function printUsage(): void {
  console.log(`Usage:
  npx tsx scripts/index-marketing-semantic-entity.ts --entity-type <type> --entity-id <id> [--dry-run]

entity-type:
  research_brief | agenda_candidate | completed_marketing_candidate

Notes:
  - Explicit entity targeting only (no bulk / index-all default)
  - --dry-run hydrates + identity lookup only (no provider call, no upsert)
  - Never prints embedding vectors or API tokens
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    process.exit(0);
  }
  if (!args.entityType || !args.entityId) {
    printUsage();
    console.error("error: --entity-type and --entity-id are required");
    process.exit(2);
  }

  const { isMarketingSemanticEntityType } = await import(
    "@/lib/marketing/semantic/entityEmbeddings/validation"
  );
  if (!isMarketingSemanticEntityType(args.entityType)) {
    console.error(`error: unsupported entity-type: ${args.entityType}`);
    process.exit(2);
  }

  const { createSemanticIndexingRuntime, indexSemanticEntity } = await import(
    "@/lib/marketing/semantic/indexing"
  );

  let runtime;
  try {
    runtime = await createSemanticIndexingRuntime({
      requireDurableStore: true,
      env: process.env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`indexing runtime unavailable: ${message}`);
    process.exit(1);
  }

  const result = await indexSemanticEntity(
    {
      entityType: args.entityType,
      entityId: args.entityId,
      dryRun: args.dryRun,
    },
    runtime,
  );

  // Safe summary only — never token / vector / full hash
  console.log(
    JSON.stringify(
      {
        status: result.status,
        entityType: result.entityType,
        entityId: result.entityId,
        model: result.model,
        revision: result.revision,
        sourceTextVersion: result.sourceTextVersion,
        contentHashPrefix: result.contentHashPrefix,
        providerCalled: result.providerCalled,
        durationMs: result.durationMs,
        dryRun: args.dryRun,
        reason: result.reason ?? null,
        message: result.message ?? null,
      },
      null,
      2,
    ),
  );

  if (result.status === "failed" || result.status === "unavailable") {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`index-marketing-semantic-entity failed: ${message}`);
  process.exit(1);
});
