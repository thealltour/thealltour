import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { plannerAnonymousKeySchema, plannerDraftInputSchema } from "@/lib/planner/schemas";
import {
  getPlannerSessionById,
  saveGeneratedPlannerPlan,
} from "@/lib/planner/repository";
import {
  generatePlannerPlan,
  toClientGenerationErrorMessage,
} from "@/lib/planner/generatePlan";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

const generateBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema,
  })
  .strict();

function toPublicPlanPayload(session: {
  id: string;
  status: string;
  sourceProductId: string | null;
  input: unknown;
  plan: unknown;
  updatedAt: string;
}) {
  return {
    id: session.id,
    status: session.status,
    sourceProductId: session.sourceProductId,
    input: session.input,
    plan: session.plan,
    updatedAt: session.updatedAt,
  };
}

/**
 * POST /api/planner/sessions/[id]/generate
 * Generates plan_json from DB input_json. Ownership required.
 */
export async function POST(request: Request, context: RouteContext) {
  if (!ENABLE_FREE_TRAVEL_PLANNER) {
    return NextResponse.json({ message: "Planner is disabled." }, { status: 404 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Invalid session id." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = generateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const memberSession = getMemberSessionFromCookies(cookieStore);
  const session = await getPlannerSessionById(id.trim());

  const ownership = assertPlannerSessionOwnership({
    session,
    anonymousKey: parsed.data.anonymousKey,
    cookieMemberId: memberSession?.memberId ?? null,
  });
  if (!ownership.ok) {
    return NextResponse.json({ message: ownership.message }, { status: ownership.status });
  }

  // Idempotent: already generated/saved → return existing without AI call
  if ((session!.status === "generated" || session!.status === "saved") && session!.plan) {
    return NextResponse.json({
      session: toPublicPlanPayload(session!),
      reused: true,
    });
  }

  const draftParsed = plannerDraftInputSchema.safeParse(session!.input);
  if (!draftParsed.success) {
    return NextResponse.json(
      { message: "여행 조건이 아직 완료되지 않았습니다.", code: "incomplete_draft" },
      { status: 400 },
    );
  }

  const startedAt = Date.now();
  try {
    const plan = await generatePlannerPlan(draftParsed.data);
    const saved = await saveGeneratedPlannerPlan({ id: session!.id, plan });
    console.info("[planner/generate]", {
      sessionId: session!.id,
      durationMs: Date.now() - startedAt,
      dayCount: plan.days.length,
      ok: true,
    });
    return NextResponse.json({
      session: toPublicPlanPayload(saved),
      reused: false,
    });
  } catch (err) {
    console.error("[planner/generate]", {
      sessionId: session!.id,
      durationMs: Date.now() - startedAt,
      ok: false,
      category: err instanceof Error ? err.name : "unknown",
    });
    return NextResponse.json(
      {
        message: toClientGenerationErrorMessage(err),
        code: "generation_failed",
      },
      { status: 502 },
    );
  }
}
