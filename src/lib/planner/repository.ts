import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PlannerSession, PlannerSessionInput, PlannerSessionStatus } from "@/types/planner";

type PlannerSessionRow = {
  id: string;
  anonymous_key: string;
  member_id: string | null;
  status: string;
  input_json: unknown;
  plan_json: unknown | null;
  source_product_id: string | null;
  created_at: string;
  updated_at: string;
};

function asInput(raw: unknown): PlannerSessionInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const destination = (raw as { destination?: unknown }).destination;
  if (typeof destination === "string" && destination.trim()) {
    return { destination: destination.trim() };
  }
  return {};
}

function mapRow(row: PlannerSessionRow): PlannerSession {
  const status = row.status as PlannerSessionStatus;
  return {
    id: row.id,
    anonymousKey: row.anonymous_key,
    memberId: row.member_id,
    status,
    input: asInput(row.input_json),
    plan: row.plan_json ?? null,
    sourceProductId: row.source_product_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CreatePlannerSessionInput = {
  anonymousKey: string;
  memberId?: string | null;
  sourceProductId?: string | null;
  input?: PlannerSessionInput;
  status?: PlannerSessionStatus;
};

/** Validate product exists; return id or null if missing/invalid. */
export async function resolvePlannerSourceProductId(
  sourceProductId: string | null | undefined,
): Promise<string | null> {
  const id = sourceProductId?.trim();
  if (!id) return null;
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[planner] resolvePlannerSourceProductId:", error.message);
    return null;
  }
  return data?.id ? String(data.id) : null;
}

export async function createPlannerSession(
  input: CreatePlannerSessionInput,
): Promise<PlannerSession> {
  const now = new Date().toISOString();
  const payload = {
    anonymous_key: input.anonymousKey,
    member_id: input.memberId?.trim() || null,
    status: input.status ?? "draft",
    input_json: input.input ?? {},
    plan_json: null,
    source_product_id: input.sourceProductId ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabaseAdmin
    .from("planner_sessions")
    .insert(payload)
    .select(
      "id, anonymous_key, member_id, status, input_json, plan_json, source_product_id, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "planner_sessions insert failed");
  }

  return mapRow(data as PlannerSessionRow);
}
