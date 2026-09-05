import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { createPlannerSessionBodySchema } from "@/lib/planner/schemas";
import {
  createPlannerSession,
  resolvePlannerSourceProductId,
} from "@/lib/planner/repository";

export const dynamic = "force-dynamic";

/**
 * POST /api/planner/sessions
 * Creates a draft planner_sessions row. member_id comes only from HMAC cookie session.
 */
export async function POST(request: Request) {
  if (!ENABLE_FREE_TRAVEL_PLANNER) {
    return NextResponse.json({ message: "Planner is disabled." }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createPlannerSessionBodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Invalid request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Intentionally ignore any client-supplied memberId (strict schema strips unknown keys).
  const { anonymousKey, destination, sourceProductId } = parsed.data;

  const cookieStore = await cookies();
  const memberSession = getMemberSessionFromCookies(cookieStore);
  const memberId = memberSession?.memberId ?? null;

  const resolvedProductId = await resolvePlannerSourceProductId(sourceProductId ?? null);

  try {
    const session = await createPlannerSession({
      anonymousKey,
      memberId,
      sourceProductId: resolvedProductId,
      input: { destination },
      status: "draft",
    });

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        sourceProductId: session.sourceProductId,
        destination: session.input.destination ?? destination,
        createdAt: session.createdAt,
      },
    });
  } catch (err) {
    console.error("[api/planner/sessions]", err);
    return NextResponse.json({ message: "Failed to create planner session." }, { status: 500 });
  }
}
