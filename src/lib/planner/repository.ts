import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerDraftInput, PlannerSession, PlannerSessionStatus } from "@/types/planner";
import { PLANNER_COMPANION_TYPES, PLANNER_INTERESTS, PLANNER_PACES } from "@/lib/planner/schemas";

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

function asInterest(value: unknown): PlannerDraftInput["interests"][number] | null {
  return typeof value === "string" && (PLANNER_INTERESTS as readonly string[]).includes(value)
    ? (value as PlannerDraftInput["interests"][number])
    : null;
}

function asCompanion(value: unknown): PlannerDraftInput["companionType"] | null {
  return typeof value === "string" && (PLANNER_COMPANION_TYPES as readonly string[]).includes(value)
    ? (value as PlannerDraftInput["companionType"])
    : null;
}

function asPace(value: unknown): PlannerDraftInput["pace"] | null {
  return typeof value === "string" && (PLANNER_PACES as readonly string[]).includes(value)
    ? (value as PlannerDraftInput["pace"])
    : null;
}

/** Normalize PR-1 string destination and partial drafts into PlannerDraftInput. */
export function normalizePlannerDraftInput(raw: unknown): PlannerDraftInput {
  const base = createEmptyPlannerDraftInput();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;

  if (typeof o.destination === "string" && o.destination.trim()) {
    base.destination = { text: o.destination.trim() };
  } else if (o.destination && typeof o.destination === "object" && !Array.isArray(o.destination)) {
    const text = (o.destination as { text?: unknown }).text;
    if (typeof text === "string") base.destination = { text: text.trim() };
  }

  if (o.dates && typeof o.dates === "object" && !Array.isArray(o.dates)) {
    const d = o.dates as { startDate?: unknown; endDate?: unknown };
    base.dates = {
      startDate: typeof d.startDate === "string" ? d.startDate.trim() : "",
      endDate: typeof d.endDate === "string" ? d.endDate.trim() : "",
    };
  }

  if (o.travelers && typeof o.travelers === "object" && !Array.isArray(o.travelers)) {
    const t = o.travelers as { adults?: unknown; children?: unknown };
    const adults = typeof t.adults === "number" && Number.isFinite(t.adults) ? Math.trunc(t.adults) : 2;
    const children =
      typeof t.children === "number" && Number.isFinite(t.children) ? Math.trunc(t.children) : 0;
    base.travelers = {
      adults: Math.min(20, Math.max(1, adults)),
      children: Math.min(20, Math.max(0, children)),
    };
  }

  const companion = asCompanion(o.companionType);
  if (companion) base.companionType = companion;

  if (Array.isArray(o.interests)) {
    const next: PlannerDraftInput["interests"] = [];
    for (const item of o.interests) {
      const interest = asInterest(item);
      if (interest && !next.includes(interest)) next.push(interest);
    }
    base.interests = next;
  }

  const pace = asPace(o.pace);
  if (pace) base.pace = pace;

  if (o.budget && typeof o.budget === "object" && !Array.isArray(o.budget)) {
    const b = o.budget as { amount?: unknown; scope?: unknown; currency?: unknown };
    const amount =
      b.amount === null
        ? null
        : typeof b.amount === "number" && Number.isFinite(b.amount) && b.amount >= 0
          ? b.amount
          : null;
    const scope = b.scope === "total" || b.scope === "per_person" ? b.scope : "per_person";
    base.budget = { amount, scope, currency: "KRW" };
  }

  if (typeof o.additionalRequest === "string") {
    base.additionalRequest = o.additionalRequest.trim().slice(0, 1000);
  }

  return base;
}

function mapRow(row: PlannerSessionRow): PlannerSession {
  return {
    id: row.id,
    anonymousKey: row.anonymous_key,
    memberId: row.member_id,
    status: row.status as PlannerSessionStatus,
    input: normalizePlannerDraftInput(row.input_json),
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
  input?: PlannerDraftInput;
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
  const draft = input.input ?? createEmptyPlannerDraftInput();
  const payload = {
    anonymous_key: input.anonymousKey,
    member_id: input.memberId?.trim() || null,
    status: input.status ?? "draft",
    input_json: draft,
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

export async function getPlannerSessionById(id: string): Promise<PlannerSession | null> {
  const { data, error } = await supabaseAdmin
    .from("planner_sessions")
    .select(
      "id, anonymous_key, member_id, status, input_json, plan_json, source_product_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[planner] getPlannerSessionById:", error.message);
    return null;
  }
  if (!data) return null;
  return mapRow(data as PlannerSessionRow);
}

export async function updatePlannerSessionInput(params: {
  id: string;
  input: PlannerDraftInput;
}): Promise<PlannerSession> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("planner_sessions")
    .update({
      input_json: params.input,
      updated_at: now,
      status: "draft",
    })
    .eq("id", params.id)
    .select(
      "id, anonymous_key, member_id, status, input_json, plan_json, source_product_id, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "planner_sessions update failed");
  }

  return mapRow(data as PlannerSessionRow);
}
