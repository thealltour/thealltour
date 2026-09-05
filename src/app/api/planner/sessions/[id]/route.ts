import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { updatePlannerSessionBodySchema } from "@/lib/planner/schemas";
import {
  getPlannerSessionById,
  updatePlannerSessionInput,
} from "@/lib/planner/repository";
import type { PlannerDraftInput } from "@/types/planner";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/planner/sessions/[id]
 * Updates input_json. Ownership: anonymous_key and/or cookie member_id.
 */
export async function PATCH(request: Request, context: RouteContext) {
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

  const parsed = updatePlannerSessionBodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Invalid request.", issues: parsed.error.issues },
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

  try {
    const updated = await updatePlannerSessionInput({
      id: id.trim(),
      input: parsed.data.input as PlannerDraftInput,
    });

    return NextResponse.json({
      session: {
        id: updated.id,
        status: updated.status,
        sourceProductId: updated.sourceProductId,
        input: updated.input,
        updatedAt: updated.updatedAt,
      },
      finalized: Boolean(parsed.data.finalize),
    });
  } catch (err) {
    console.error("[api/planner/sessions/PATCH]", err);
    return NextResponse.json({ message: "Failed to update planner session." }, { status: 500 });
  }
}
