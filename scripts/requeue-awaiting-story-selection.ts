/**
 * One-shot: requeue COMPLETED+awaiting_story_selection requests that already
 * have an active human Story selection (stuck resume after remine wipe).
 *
 * Usage: npx tsx scripts/requeue-awaiting-story-selection.ts [--date 2026-09-18] [--execute]
 * Default is dry-run.
 */
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { buildRequeuedAwaitingStorySelectionRequest } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import { normalizeProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import { readHumanStorySelection, selectionIsActive } from "@/lib/marketing/storyPoint/humanStorySelection";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      let v = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

async function main() {
  loadEnv();
  const date = argValue("--date") ?? "2026-09-18";
  const execute = process.argv.includes("--execute");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("missing supabase env");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("daily_marketing_production_requests")
    .select("logical_run_key,status,payload,updated_at")
    .eq("business_date_kst", date)
    .eq("status", "COMPLETED")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const now = new Date();
  const targets: Array<{ logicalRunKey: string; title: string | null; selectedId: string }> = [];
  for (const row of data ?? []) {
    const request = normalizeProductionRequest(row.payload);
    if (request.metadata?.productionOutcome !== "awaiting_story_selection") continue;
    const human = readHumanStorySelection(request);
    if (!selectionIsActive(human)) continue;
    targets.push({
      logicalRunKey: request.logicalRunKey,
      title: request.selection?.title ?? null,
      selectedId: human!.selectedStoryPointId!,
    });
    if (!execute) continue;
    const requeued = buildRequeuedAwaitingStorySelectionRequest(request, now);
    const { error: upErr } = await sb
      .from("daily_marketing_production_requests")
      .update({
        status: requeued.status,
        payload: requeued,
        claimed_at: null,
        started_at: null,
        completed_at: null,
        failed_at: null,
        attempt_count: 0,
        claim_token: null,
        last_error: null,
        worker_id: null,
        updated_at: requeued.updatedAt,
      })
      .eq("logical_run_key", request.logicalRunKey)
      .eq("status", "COMPLETED");
    if (upErr) throw new Error(upErr.message);
  }

  console.log(
    JSON.stringify(
      {
        date,
        execute,
        count: targets.length,
        targets,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
