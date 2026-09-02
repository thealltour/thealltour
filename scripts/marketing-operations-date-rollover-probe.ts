#!/usr/bin/env node
/**
 * STEP 3-10 date rollover idempotency probe (memory backend).
 *   npx tsx scripts/marketing-operations-date-rollover-probe.ts
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

import { loadLocalEnv } from "./loadLocalEnv";
loadLocalEnv();

async function main() {
  const { runDailyMarketingPipeline } = await import("@/lib/marketing/cron/daily/runDailyMarketingPipeline");
  const { createInMemoryDailyMarketingRunRepository } = await import(
    "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { createInMemoryContentAssignmentStore } = await import(
    "@/lib/marketing/content/store/contentAssignmentStore"
  );
  const { createInMemoryGovernanceReviewStore } = await import(
    "@/lib/marketing/content/governance/store/governanceReviewStore"
  );
  const {
    buildResearchContext,
    managerSelectJson,
    NOW,
    PRODUCT,
  } = await import("@/lib/marketing/cron/daily/__tests__/fixtures");

  const repo = createInMemoryDailyMarketingRunRepository();
  const deps = {
    repo,
    now: NOW,
    contentAssignmentStore: createInMemoryContentAssignmentStore(),
    governanceReviewStore: createInMemoryGovernanceReviewStore(),
    getResearchContext: async () => buildResearchContext(),
    invokeManagerProfile: async () => managerSelectJson(),
    requestDraft: async () => ({
      title: "Japan autumn update",
      body: "Official guidance says autumn travel planning is easier.",
      channel: "threads",
      agenda: "Japan autumn travel update",
      sourceReferences: ["evidence:ev-official"],
      assignmentId: null,
    }),
    requestGovernance: async () => ({
      decision: "ALLOW" as const,
      riskScore: 0,
      reasons: ["NO_RISK_SIGNAL"],
      revisionHints: [],
      humanApprovalRequired: false,
      semanticAvailable: true,
    }),
    requestPerformance: async () => ({ unavailable: true as const, reason: "probe" }),
  };

  const dayN = "2099-02-01";
  const dayN1 = "2099-02-02";
  const first = await runDailyMarketingPipeline({ productId: PRODUCT, channel: "threads", businessDateKst: dayN }, deps);
  const rerun = await runDailyMarketingPipeline({ productId: PRODUCT, channel: "threads", businessDateKst: dayN }, deps);
  const next = await runDailyMarketingPipeline({ productId: PRODUCT, channel: "threads", businessDateKst: dayN1 }, deps);

  const dayNCandidates = await repo.listCandidates({ businessDateKst: dayN });
  const dayN1Candidates = await repo.listCandidates({ businessDateKst: dayN1 });

  console.log(
    JSON.stringify(
      {
        dayN: {
          firstIdempotent: first.idempotent,
          rerunIdempotent: rerun.idempotent,
          candidateCount: dayNCandidates.length,
          logicalRunKey: first.run.logicalRunKey,
        },
        dayN1: {
          idempotent: next.idempotent,
          candidateCount: dayN1Candidates.length,
          logicalRunKey: next.run.logicalRunKey,
          distinctFromDayN: next.run.logicalRunKey !== first.run.logicalRunKey,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
