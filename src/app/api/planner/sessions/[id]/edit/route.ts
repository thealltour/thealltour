import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { plannerDraftInputSchema, plannerEditBodySchema } from "@/lib/planner/schemas";
import { getPlannerSessionById } from "@/lib/planner/repository";
import { persistEditedPlannerPlan } from "@/lib/planner/planVersionRepository";
import {
  generateEditedPlannerPlan,
  toClientEditErrorMessage,
} from "@/lib/planner/generatePlan";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/planner/sessions/[id]/edit
 * Regenerates plan_json from DB input_json + current plan + instruction.
 * Never accepts planJson / memberId / status from the client.
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

  const parsed = plannerEditBodySchema.safeParse(json);
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
    anonymousKey: parsed.data.anonymousKey ?? null,
    cookieMemberId: memberSession?.memberId ?? null,
  });
  if (!ownership.ok) {
    return NextResponse.json({ message: ownership.message }, { status: ownership.status });
  }

  if (session!.status !== "generated" && session!.status !== "saved") {
    return NextResponse.json(
      { message: "수정할 수 없는 플랜 상태입니다.", code: "invalid_status" },
      { status: 409 },
    );
  }

  if (!session!.plan) {
    return NextResponse.json(
      { message: "수정할 일정이 없습니다.", code: "missing_plan" },
      { status: 409 },
    );
  }

  const draftParsed = plannerDraftInputSchema.safeParse(session!.input);
  if (!draftParsed.success) {
    return NextResponse.json(
      { message: "여행 조건이 올바르지 않습니다.", code: "incomplete_draft" },
      { status: 400 },
    );
  }

  const instruction = parsed.data.instruction;
  const instructionLength = instruction.length;
  const startedAt = Date.now();
  const previousPlan = session!.plan;
  const status = session!.status;

  try {
    const nextPlan = await generateEditedPlannerPlan({
      draft: draftParsed.data,
      currentPlan: previousPlan,
      instruction,
    });

    const { versionNumber } = await persistEditedPlannerPlan({
      sessionId: session!.id,
      previousPlan,
      nextPlan,
      editInstruction: instruction,
      status,
    });

    const refreshed = await getPlannerSessionById(session!.id);
    const durationMs = Date.now() - startedAt;
    console.info("[planner] edit ok", {
      sessionId: session!.id,
      durationMs,
      instructionLength,
      versionNumber,
      status,
    });

    return NextResponse.json({
      session: {
        id: refreshed?.id ?? session!.id,
        status: refreshed?.status ?? status,
        sourceProductId: refreshed?.sourceProductId ?? session!.sourceProductId,
        plan: refreshed?.plan ?? nextPlan,
        isSaved: (refreshed?.status ?? status) === "saved",
        updatedAt: refreshed?.updatedAt ?? new Date().toISOString(),
      },
      versionNumber,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.info("[planner] edit failed", {
      sessionId: session!.id,
      durationMs,
      instructionLength,
      category: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { message: toClientEditErrorMessage(error), code: "edit_failed" },
      { status: 502 },
    );
  }
}
