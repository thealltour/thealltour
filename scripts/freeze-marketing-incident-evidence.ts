#!/usr/bin/env node
/**
 * STEP 3-11: read-only incident evidence capture.
 *   npx tsx scripts/freeze-marketing-incident-evidence.ts --businessDate=2026-09-02
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

function parseBusinessDate(argv: string[]): string {
  const arg = argv.find((item) => item.startsWith("--businessDate="));
  return arg?.split("=")[1]?.trim() ?? "2026-09-02";
}

async function main() {
  const businessDateKst = parseBusinessDate(process.argv.slice(2));
  const logicalRunKey = `daily-marketing-plan:${businessDateKst}`;

  const { createDailyMarketingRunRepository } = await import(
    "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { buildLogicalDailyRunKey } = await import("@/lib/marketing/cron/daily/kstBusinessDate");
  const { DAILY_MARKETING_ROUTINE_ID } = await import("@/lib/marketing/cron/daily/types");
  const { readLatestPerformanceBrief } = await import("@/lib/marketing/cron/performanceBriefArtifact");
  const { getDefaultGovernanceReviewStore } = await import("@/lib/marketing/content/governance");

  const repo = await createDailyMarketingRunRepository({ backend: "supabase" });
  const run = await repo.findRunByLogicalKey(
    buildLogicalDailyRunKey({ routineId: DAILY_MARKETING_ROUTINE_ID, businessDateKst }),
  );
  const candidate = await repo.findCandidateByLogicalKey(logicalRunKey);
  const brief = readLatestPerformanceBrief();

  let governanceReviews: unknown[] = [];
  const assignmentId = run?.assignmentId ?? run?.observability?.assignmentId ?? null;
  if (assignmentId) {
    const store = getDefaultGovernanceReviewStore();
    if ("listByAssignmentId" in store && typeof store.listByAssignmentId === "function") {
      governanceReviews = store.listByAssignmentId(assignmentId);
    }
  }

  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const runtimeObs = run?.correlationId
    ? await supabaseAdmin
        .from("ai_runtime_observability_events")
        .select(
          "id,occurred_at,event_type,correlation_id,workload,provider_id,model_id,status,error_code,agent_id,metadata_json",
        )
        .eq("correlation_id", run.correlationId)
        .order("occurred_at", { ascending: true })
        .limit(20)
    : { data: [], error: null };

  console.log(
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        businessDateKst,
        logicalRunKey,
        run: run
          ? {
              runId: run.runId,
              status: run.status,
              failureReason: run.failureReason,
              correlationId: run.correlationId,
              executionAttempt: run.executionAttempt,
              startedAt: run.startedAt,
              completedAt: run.completedAt,
              researchStatus: run.researchStatus,
              selectedAgendaId: run.selectedAgendaId,
              assignmentId: run.assignmentId,
              governanceReviewId: run.governanceReviewId,
              completedCandidateId: run.completedCandidateId,
              degraded: run.degraded,
              observability: run.observability,
              metadata: run.metadata,
            }
          : null,
        candidate: candidate
          ? {
              candidateId: candidate.candidateId,
              status: candidate.status,
              governanceDecision: candidate.governanceDecision?.decision ?? null,
            }
          : null,
        performanceBriefArtifact: brief
          ? { generatedAt: brief.generatedAt, dataAvailability: brief.dataAvailability }
          : null,
        governanceReviewsInMemoryStore: governanceReviews,
        runtimeObservabilityEvents: runtimeObs.error ? { error: runtimeObs.error.message } : runtimeObs.data ?? [],
        runtimeObservabilitySummary: runtimeObs.error
          ? null
          : {
              total: (runtimeObs.data ?? []).length,
              workloads: [...new Set((runtimeObs.data ?? []).map((e) => (e as { workload?: string }).workload).filter(Boolean))],
              governanceEvents: (runtimeObs.data ?? []).filter((e) => (e as { workload?: string }).workload === "governance"),
              failedEvents: (runtimeObs.data ?? []).filter(
                (e) => (e as { error_code?: string | null; status?: string | null }).error_code || (e as { status?: string }).status === "failed",
              ),
            },
        payloadExcerpt: run?.metadata?.pipelineFailure ?? run?.observability ?? null,
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
