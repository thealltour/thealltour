import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  PLANNER_QUOTA_RESERVATION_TTL_MS,
  type PlannerQuotaSubject,
  type ReservePlannerQuotaResult,
} from "@/lib/planner/quota/types";

type RpcJson = Record<string, unknown> | null;

function asResult(data: unknown): ReservePlannerQuotaResult | null {
  if (!data || typeof data !== "object") return null;
  const result = (data as { result?: unknown }).result;
  if (result === "reserved" || result === "already_consumed" || result === "already_reserved") {
    return result;
  }
  return null;
}

export async function reservePlannerGenerationQuota(params: {
  subject: PlannerQuotaSubject;
  sessionId: string;
  now?: Date;
  staleAfterMs?: number;
}): Promise<ReservePlannerQuotaResult> {
  const { data, error } = await supabaseAdmin.rpc("reserve_planner_generation_quota", {
    p_subject_type: params.subject.subjectType,
    p_subject_id: params.subject.subjectId,
    p_window_type: params.subject.windowType,
    p_window_key: params.subject.windowKey,
    p_session_id: params.sessionId,
    p_now: (params.now ?? new Date()).toISOString(),
    p_stale_after_ms: params.staleAfterMs ?? PLANNER_QUOTA_RESERVATION_TTL_MS,
  });

  if (error) {
    console.error("[planner/quota] reserve failed:", error.message);
    throw new Error("quota_reserve_failed");
  }

  const parsed = asResult(data as RpcJson);
  if (!parsed) {
    console.error("[planner/quota] reserve unexpected payload");
    throw new Error("quota_reserve_failed");
  }
  return parsed;
}

export async function consumePlannerGenerationQuota(params: {
  sessionId: string;
  now?: Date;
}): Promise<"consumed" | "not_found"> {
  const { data, error } = await supabaseAdmin.rpc("consume_planner_generation_quota", {
    p_session_id: params.sessionId,
    p_now: (params.now ?? new Date()).toISOString(),
  });

  if (error) {
    console.error("[planner/quota] consume failed:", error.message);
    throw new Error("quota_consume_failed");
  }

  const result =
    data && typeof data === "object" ? (data as { result?: unknown }).result : null;
  if (result === "consumed" || result === "not_found") return result;
  console.error("[planner/quota] consume unexpected payload");
  throw new Error("quota_consume_failed");
}

export async function releasePlannerGenerationQuota(params: {
  sessionId: string;
}): Promise<"released" | "not_found"> {
  const { data, error } = await supabaseAdmin.rpc("release_planner_generation_quota", {
    p_session_id: params.sessionId,
  });

  if (error) {
    console.error("[planner/quota] release failed:", error.message);
    // Fail-soft: do not mask generation error; stale TTL recovers.
    return "not_found";
  }

  const result =
    data && typeof data === "object" ? (data as { result?: unknown }).result : null;
  if (result === "released" || result === "not_found") return result;
  return "not_found";
}
