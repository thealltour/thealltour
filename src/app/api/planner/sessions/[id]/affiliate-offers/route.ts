import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isPlannerAffiliateEnabledForKey,
  isPlannerAffiliateMasterEnabled,
  resolveAffiliateRolloutIdentity,
} from "@/config/affiliateRollout";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { plannerAnonymousKeySchema } from "@/lib/planner/schemas";
import { getPlannerSessionById } from "@/lib/planner/repository";
import type { PlannerAffiliateOffersDto } from "@/lib/affiliate/planner/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

const EMPTY_OFFERS: PlannerAffiliateOffersDto = {
  summary: [],
  preparation: [],
  days: {},
  disclosure: null,
};

/**
 * POST /api/planner/sessions/[id]/affiliate-offers
 * Server-side routing only. Soft-fails empty on error; never blocks Result.
 *
 * Gate order: MASTER → percent bucket → build (no network when excluded).
 *
 * Excluded canary response: **empty DTO 200** (not 404).
 * Reason: PlannerAffiliateOffers treats !res.ok as silent no-op (no user-visible
 * error either way), but when master=true a high exclude rate would inflate 404
 * metrics. Empty DTO matches soft-fail / no-offer paths and stays quiet.
 */
export async function POST(request: Request, context: RouteContext) {
  if (!ENABLE_FREE_TRAVEL_PLANNER || !isPlannerAffiliateMasterEnabled()) {
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

  // Percent gate AFTER master, BEFORE build — excluded never hits providers.
  const identity = resolveAffiliateRolloutIdentity(session!);
  if (!isPlannerAffiliateEnabledForKey(identity.key)) {
    return NextResponse.json({ offers: EMPTY_OFFERS }, { status: 200 });
  }

  if (!session!.plan) {
    return NextResponse.json({ offers: EMPTY_OFFERS }, { status: 200 });
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
    const { logAffiliateOfferBuildFailed } = await import(
      "@/lib/affiliate/planner/affiliateOfferBuildFailed"
    );
    logAffiliateOfferBuildFailed({
      sessionId: session!.id,
      reason: "unexpected",
    });
    return NextResponse.json({ offers: EMPTY_OFFERS }, { status: 200 });
  }
}
