#!/usr/bin/env node
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
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { PUBLICATION_FLOW_INACTIVE, SNS_SIDE_EFFECTS_STEP_3_8 } = await import(
    "../src/lib/marketing/social/publication/governanceBoundary"
  );
  const tables = ["completed_marketing_candidates", "human_marketing_reviews", "social_publications"] as const;
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const { count, error } = await supabaseAdmin.from(t).select("*", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    counts[t] = count ?? 0;
  }

  const { data: review } = await supabaseAdmin
    .from("human_marketing_reviews")
    .select("review_id,candidate_id,status,approved_at,human_edited_after_governance")
    .eq("candidate_id", "cmc_step_3_8_verification")
    .maybeSingle();

  console.log(
    JSON.stringify(
      {
        counts,
        verificationReview: review,
        PUBLICATION_FLOW_INACTIVE,
        SNS_SIDE_EFFECTS_STEP_3_8,
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
