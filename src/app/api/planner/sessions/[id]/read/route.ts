import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { plannerAnonymousKeySchema } from "@/lib/planner/schemas";
import { getPlannerSessionById } from "@/lib/planner/repository";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const readBodySchema = z
  .object({
    /** Required for anonymous sessions; optional when cookie member owns the plan. */
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

/**
 * POST /api/planner/sessions/[id]/read
 * Authorized private read — never exposes anonymous_key / member_id.
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

  const parsed = readBodySchema.safeParse(json);
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

  const isOwner =
    Boolean(session!.memberId) &&
    Boolean(memberSession?.memberId) &&
    session!.memberId === memberSession!.memberId;

  return NextResponse.json({
    session: {
      id: session!.id,
      status: session!.status,
      sourceProductId: session!.sourceProductId,
      input: {
        destination: session!.input.destination,
        dates: session!.input.dates,
        travelers: session!.input.travelers,
        companionType: session!.input.companionType,
        interests: session!.input.interests,
        pace: session!.input.pace,
        // additionalRequest intentionally omitted from read payload for privacy
      },
      plan: session!.plan,
      isSaved: session!.status === "saved",
      isOwner,
      updatedAt: session!.updatedAt,
    },
  });
}
