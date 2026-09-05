import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { plannerPlanSchema, type PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerSessionStatus } from "@/types/planner";

async function getMaxVersionNumber(sessionId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("planner_plan_versions")
    .select("version_number")
    .eq("planner_session_id", sessionId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[planner] getMaxVersionNumber:", error.message);
    throw new Error("Failed to read plan versions");
  }
  const n = data?.version_number;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

async function insertPlanVersion(params: {
  sessionId: string;
  versionNumber: number;
  plan: PlannerPlan;
  editInstruction: string | null;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from("planner_plan_versions").insert({
    planner_session_id: params.sessionId,
    version_number: params.versionNumber,
    plan_json: params.plan,
    edit_instruction: params.editInstruction,
  });
  if (!error) return true;
  // Unique violation → caller may retry
  if (error.code === "23505") return false;
  console.error("[planner] insertPlanVersion:", error.message);
  throw new Error("Failed to insert plan version");
}

/**
 * Ensure the current plan is snapshotted as version 1 before first edit.
 * Idempotent when versions already exist.
 */
export async function ensureBootstrapPlanVersion(params: {
  sessionId: string;
  currentPlan: PlannerPlan;
}): Promise<number> {
  const max = await getMaxVersionNumber(params.sessionId);
  if (max >= 1) return max;

  const inserted = await insertPlanVersion({
    sessionId: params.sessionId,
    versionNumber: 1,
    plan: params.currentPlan,
    editInstruction: null,
  });
  if (inserted) return 1;
  return getMaxVersionNumber(params.sessionId);
}

/**
 * Persist edited plan: version history first, then replace current plan_json.
 * On failure before replace, current plan_json is untouched.
 * Status (generated|saved) and member_id / input_json are preserved.
 */
export async function persistEditedPlannerPlan(params: {
  sessionId: string;
  previousPlan: PlannerPlan;
  nextPlan: PlannerPlan;
  editInstruction: string;
  status: Extract<PlannerSessionStatus, "generated" | "saved">;
}): Promise<{ versionNumber: number }> {
  plannerPlanSchema.parse(params.nextPlan);

  const maxBefore = await ensureBootstrapPlanVersion({
    sessionId: params.sessionId,
    currentPlan: params.previousPlan,
  });

  let nextVersion = maxBefore + 1;
  let inserted = await insertPlanVersion({
    sessionId: params.sessionId,
    versionNumber: nextVersion,
    plan: params.nextPlan,
    editInstruction: params.editInstruction.slice(0, 1000),
  });

  if (!inserted) {
    const max = await getMaxVersionNumber(params.sessionId);
    nextVersion = max + 1;
    inserted = await insertPlanVersion({
      sessionId: params.sessionId,
      versionNumber: nextVersion,
      plan: params.nextPlan,
      editInstruction: params.editInstruction.slice(0, 1000),
    });
    if (!inserted) {
      throw new Error("Failed to insert plan version after retry");
    }
  }

  // Only after version snapshot succeeds, overwrite current plan
  const now = new Date().toISOString();
  const { data, error: updateError } = await supabaseAdmin
    .from("planner_sessions")
    .update({
      plan_json: params.nextPlan,
      updated_at: now,
    })
    .eq("id", params.sessionId)
    .eq("status", params.status)
    .select("id")
    .maybeSingle();

  if (updateError || !data) {
    console.error("[planner] persistEditedPlannerPlan update:", updateError?.message ?? "no row");
    throw new Error("Failed to update planner plan");
  }

  return { versionNumber: nextVersion };
}
