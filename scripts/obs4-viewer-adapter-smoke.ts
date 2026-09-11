#!/usr/bin/env npx tsx
/** Read-only OBS-4 adapter check against durable Supabase traces. */
import { createRequire } from "node:module";
import { loadLocalEnv } from "./loadLocalEnv";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
};
const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function resolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === "server-only") return require.resolve("./shims/server-only.js");
  return originalResolve(request, parent, isMain, options);
};

loadLocalEnv();

async function main() {
  const { createServerMarketingTraceReadRepository } = await import(
    "@/lib/marketing/observability/viewer/serverReadRepository"
  );
  const { marketingTraceToOtlpDocument } = await import(
    "@/lib/marketing/observability/viewer/otlpDocument"
  );
  const { marketingSpanDisplayName } = await import(
    "@/lib/marketing/observability/viewer/displayLabels"
  );
  const repo = await createServerMarketingTraceReadRepository();
  if (!repo) {
    console.log(JSON.stringify({ ok: false, error: "no_repo" }));
    process.exit(1);
  }
  const recent = await repo.listRecentTraces({ limit: 10 });
  const smoke =
    recent.find((t) => (t.productionRequestId || "").includes("obs3-smoke")) ?? recent[0];
  if (!smoke) {
    console.log(JSON.stringify({ ok: false, error: "no_traces" }));
    process.exit(1);
  }
  const spans = await repo.listTraceSpans(smoke.traceId);
  const doc = marketingTraceToOtlpDocument({ ...smoke, spans }, spans);
  const otlp = doc.resourceSpans[0]?.scopeSpans[0]?.spans ?? [];
  const root = otlp.find((s) => !s.parentSpanId);
  const children = otlp.filter((s) => s.parentSpanId === root?.spanId);
  const attrBlob = JSON.stringify(otlp.map((s) => s.attributes));
  console.log(
    JSON.stringify(
      {
        ok:
          spans.length >= 1 &&
          root != null &&
          children.length >= 1 &&
          spans.every((s) => s.status !== "running") &&
          !/input\.value|output\.value|api_key|prompt_text/i.test(attrBlob),
        listed: recent.length,
        selected_trace_id: smoke.traceId,
        status: smoke.status,
        production_request_id: smoke.productionRequestId,
        span_count: spans.length,
        root_display: root?.name ?? null,
        child_displays: children.map((c) => c.name),
        dangling_running: spans.filter((s) => s.status === "running").length,
        sample_label: marketingSpanDisplayName("marketing.content_strategist", 2),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
