import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ENABLE_FREE_TRAVEL_PLANNER,
  ENABLE_PLANNER_AFFILIATE_ROUTER,
} from "@/config/featureFlags";
import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { plannerAnonymousKeySchema } from "@/lib/planner/schemas";
import { getPlannerSessionById } from "@/lib/planner/repository";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

/**
 * POST /api/planner/sessions/[id]/affiliate-offers
 * Server-side routing only. Soft-fails empty on error; never blocks Result.
 */
export async function POST(request: Request, context: RouteContext) {
  if (!ENABLE_FREE_TRAVEL_PLANNER || !ENABLE_PLANNER_AFFILIATE_ROUTER) {
    return NextResponse.json({ message: "Affiliate router is disabled." }, { status: 404 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Invalid session id." }, { status: 400 });
  }

  let json: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) json = JSON.parse(text);
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
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
      { message: "Offers unavailable for this plan status.", code: "invalid_status" },
      { status: 409 },
    );
  }

  if (!session!.plan) {
    return NextResponse.json(
      {
        offers: { summary: [], preparation: [], days: {}, disclosure: null },
      },
      { status: 200 },
    );
  }

  try {
    const offers = await buildAffiliateOffersForSession({
      sessionId: session!.id,
      plan: session!.plan,
      input: session!.input,
      sourceProductId: session!.sourceProductId,
    });
    return NextResponse.json({ offers });
  } catch {
    console.info("[affiliate] offers API failed", { sessionId: session!.id });
    return NextResponse.json(
      {
        offers: { summary: [], preparation: [], days: {}, disclosure: null },
      },
      { status: 200 },
    );
  }
}
