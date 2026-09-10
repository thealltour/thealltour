#!/usr/bin/env npx tsx
/**
 * OBS-3 scoped durable smoke against production Supabase.
 * No ProductionRequest / CMC / HMR / SNS / cron. Trace-only writes.
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

const FIXTURE_PR = `obs3-smoke-pr-${Date.now()}`;
const FORBIDDEN_RE =
  /api[_-]?key|password|secret|authorization|bearer|sk-|prompt_text|full_prompt|model_response|chain_of_thought|evidence_body/i;

async function main() {
  const { isMarketingTraceEnabled } = await import(
    "@/lib/marketing/observability/persistence/factory"
  );
  const { createObservabilitySupabaseClientFromEnv } = await import(
    "@/ai-runtime/observability/persistence/supabase-client"
  );
  const { createSupabaseMarketingTraceStore } = await import(
    "@/lib/marketing/observability/persistence/supabaseStore"
  );
  const { createMarketingTraceReadRepository } = await import(
    "@/lib/marketing/observability/persistence/repository"
  );
  const { createPersistentMarketingTraceRecorder } = await import(
    "@/lib/marketing/observability/persistence/persistentRecorder"
  );
  const { MARKETING_ATTR } = await import("@/lib/marketing/observability/attributes");

  const enabled = isMarketingTraceEnabled();
  const client = createObservabilitySupabaseClientFromEnv();
  if (!enabled) {
    console.log(JSON.stringify({ ok: false, error: "MARKETING_TRACE_ENABLED_OFF" }));
    process.exit(1);
  }
  if (!client) {
    console.log(JSON.stringify({ ok: false, error: "SUPABASE_CLIENT_MISSING" }));
    process.exit(1);
  }

  const store = createSupabaseMarketingTraceStore(client as never);
  const recorder = createPersistentMarketingTraceRecorder({
    store,
    onError: (message) => console.warn("[obs3-smoke]", message),
  });
  const readRepo = createMarketingTraceReadRepository(store);

  // NOTE: Do not call the production factory recorder's startTrace as a side probe.
  // When MARKETING_TRACE_ENABLED=true that persists a durable RUNNING row with no endTrace
  // (OBS-4 production acceptance found orphan probes from an earlier smoke helper).

  const { traceId, trace } = recorder.startTrace({
    traceType: "marketing_production",
    correlation: {
      productionRequestId: FIXTURE_PR,
      logicalRunKey: `obs3-smoke:${FIXTURE_PR}`,
      assignmentId: "obs3-smoke-assignment",
    },
    attributes: {
      [MARKETING_ATTR.CHANNEL]: "threads",
      "marketing.fixture": "obs3_durable_smoke",
      "marketing.fixture.kind": "test_only",
      // must be dropped at persistence boundary
      api_key: "should-never-persist",
      prompt_text: "FULL PROMPT MUST NOT PERSIST",
    },
  });

  const root = recorder.startSpan({
    traceId,
    name: "marketing.production",
    kind: "orchestration",
    stage: "production_request",
    actorType: "system",
    attributes: { "marketing.fixture": "obs3_durable_smoke" },
  });
  const childNames = [
    ["marketing.manager", "marketing_manager", "hermes_bot", "marketing-manager"],
    ["marketing.deliverable_requirements", "deliverable_requirements", "typescript_staff", "deliverable_requirements"],
    ["marketing.evidence_pack", "evidence_pack", "typescript_staff", "evidence_pack"],
    ["marketing.content_strategist", "content_strategist", "hermes_bot", "content-strategist"],
    ["marketing.completeness_validator", "completeness_validator", "typescript_staff", "completeness_validator"],
    ["marketing.governance_auditor", "governance_auditor", "hermes_bot", "governance-auditor"],
    ["marketing.human_review_boundary", "human_review", "human", "hmr"],
  ] as const;

  const childIds: string[] = [];
  for (const [name, stage, actorType, actorId] of childNames) {
    const started = recorder.startSpan({
      traceId,
      parentSpanId: root.spanId,
      name,
      kind: name.includes("validator")
        ? "validation"
        : name.includes("requirements") || name.includes("evidence")
          ? "deterministic"
          : name.includes("human")
            ? "human_boundary"
            : name.includes("production")
              ? "orchestration"
              : "agent",
      stage: stage as never,
      actorType: actorType as never,
      actorId,
      attributes: { "marketing.fixture": "obs3_durable_smoke" },
    });
    childIds.push(started.spanId);
    recorder.endSpan({
      traceId,
      spanId: started.spanId,
      status: "ok",
      otelStatusCode: "OK",
    });
  }

  recorder.endSpan({
    traceId,
    spanId: root.spanId,
    status: "ok",
    otelStatusCode: "OK",
  });
  recorder.endTrace({
    traceId,
    status: "completed",
    correlation: {
      candidateId: "obs3-smoke-candidate",
      reviewId: "obs3-smoke-hmr",
    },
  });
  await recorder.flush();

  const read = await readRepo.getTrace(traceId);
  const spans = await readRepo.listTraceSpans(traceId);
  const byPr = await readRepo.findTraceByProductionRequestId(FIXTURE_PR);

  const dangling = spans.filter((s) => s.status === "running").length;
  const attrBlob = JSON.stringify({
    traceAttrs: (await store.getTraceRow(traceId))?.attributes ?? {},
    spanAttrs: spans.map((s) => s.attributes),
  });
  const privacyHit = FORBIDDEN_RE.test(attrBlob);

  const report = {
    ok:
      Boolean(read) &&
      read?.status === "completed" &&
      byPr?.traceId === traceId &&
      spans.length === 1 + childNames.length &&
      dangling === 0 &&
      !privacyHit &&
      spans.some((s) => s.name === "marketing.production") &&
      childNames.every(([name]) => spans.some((s) => s.name === name)),
    gate_enabled: enabled,
    fixture_production_request_id: FIXTURE_PR,
    trace_id: traceId,
    stored_trace_status: read?.status ?? null,
    stored_span_count: spans.length,
    root_span: spans.find((s) => s.name === "marketing.production")?.spanId ?? null,
    child_span_names: spans.filter((s) => s.parentSpanId).map((s) => s.name).sort(),
    correlation: {
      productionRequestId: read?.productionRequestId ?? null,
      assignmentId: read?.assignmentId ?? null,
      candidateId: read?.candidateId ?? null,
      reviewId: read?.reviewId ?? null,
    },
    dangling_running_spans: dangling,
    privacy_forbidden_found: privacyHit,
    find_by_pr_match: byPr?.traceId === traceId,
    started_local_trace_type: trace.traceType,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
