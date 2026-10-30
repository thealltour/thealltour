import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { plannerPlanSchema, type PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerSessionStatus } from "@/types/planner";

export class PlannerPlanVersionConflictError extends Error {
  constructor(message = "PLAN_VERSION_CONFLICT") {
    super(message);
    this.name = "PlannerPlanVersionConflictError";
  }
}

export class PlannerPlanPersistError extends Error {
  readonly code: "not_found" | "invalid_status" | "missing_plan" | "invalid_plan" | "persist_failed";

  constructor(
    code: PlannerPlanPersistError["code"],
    message = "Failed to update planner plan",
  ) {
    super(message);
    this.name = "PlannerPlanPersistError";
    this.code = code;
  }
}

type PersistRpcOutcome =
  | {
      outcome: "updated";
      version_number: number;
      updated_at: string;
      status?: string;
    }
  | {
      outcome: "conflict";
      updated_at?: string;
      status?: string;
    }
  | {
      outcome: "not_found" | "invalid_status" | "missing_plan" | "invalid_plan";
      status?: string;
    };

function parsePersistRpcPayload(data: unknown): PersistRpcOutcome | null {
  if (!data || typeof data !== "object") return null;
  const outcome = (data as { outcome?: unknown }).outcome;
  if (
    outcome !== "updated" &&
    outcome !== "conflict" &&
    outcome !== "not_found" &&
    outcome !== "invalid_status" &&
    outcome !== "missing_plan" &&
    outcome !== "invalid_plan"
  ) {
    return null;
  }

  if (outcome === "updated") {
    const versionNumber = (data as { version_number?: unknown }).version_number;
    const updatedAt = (data as { updated_at?: unknown }).updated_at;
    if (typeof versionNumber !== "number" || !Number.isFinite(versionNumber)) return null;
    if (typeof updatedAt !== "string" || !updatedAt) return null;
    return {
      outcome: "updated",
      version_number: versionNumber,
      updated_at: updatedAt,
      status:
        typeof (data as { status?: unknown }).status === "string"
          ? (data as { status: string }).status
          : undefined,
    };
  }

  return data as PersistRpcOutcome;
}

/**
 * Persist edited plan atomically via DB RPC:
 * FOR UPDATE session → optional updated_at CAS → bootstrap v1 from DB plan_json →
 * insert next version → update plan_json (status preserved).
 *
 * `previousPlan` is retained for call-site compatibility but is NOT trusted;
 * the RPC snapshots locked `planner_sessions.plan_json`.
 *
 * When `expectedUpdatedAt` is set (Manual Edit), mismatch → PlannerPlanVersionConflictError
 * with zero version inserts (no orphan rows).
 */
export async function persistEditedPlannerPlan(params: {
  sessionId: string;
  /** @deprecated Unused — authoritative previous plan is locked DB plan_json. */
  previousPlan: PlannerPlan;
  nextPlan: PlannerPlan;
  editInstruction: string;
  status: Extract<PlannerSessionStatus, "generated" | "saved">;
  expectedUpdatedAt?: string;
}): Promise<{ versionNumber: number; updatedAt: string }> {
  void params.previousPlan;
  plannerPlanSchema.parse(params.nextPlan);

  const expected = params.expectedUpdatedAt?.trim() || null;

  const { data, error } = await supabaseAdmin.rpc("persist_planner_plan_edit", {
    p_session_id: params.sessionId,
    p_next_plan: params.nextPlan,
    p_edit_instruction: params.editInstruction.slice(0, 1000),
    p_status: params.status,
    p_expected_updated_at: expected,
  });

  if (error) {
    console.error("[planner] persist_planner_plan_edit rpc:", error.message);
    throw new PlannerPlanPersistError("persist_failed");
  }

  const parsed = parsePersistRpcPayload(data);
  if (!parsed) {
    console.error("[planner] persist_planner_plan_edit unexpected payload");
    throw new PlannerPlanPersistError("persist_failed");
  }

  if (parsed.outcome === "conflict") {
    throw new PlannerPlanVersionConflictError();
  }
  if (parsed.outcome === "updated") {
    return {
      versionNumber: parsed.version_number,
      updatedAt: parsed.updated_at,
    };
  }
  if (parsed.outcome === "not_found") {
    throw new PlannerPlanPersistError("not_found", "Planner session not found");
  }
  if (parsed.outcome === "invalid_status") {
    throw new PlannerPlanPersistError("invalid_status", "Invalid planner session status");
  }
  if (parsed.outcome === "missing_plan") {
    throw new PlannerPlanPersistError("missing_plan", "Planner session has no plan");
  }
  throw new PlannerPlanPersistError("invalid_plan", "Invalid plan payload");
}
