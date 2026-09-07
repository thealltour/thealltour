import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ENABLE_FREE_TRAVEL_PLANNER,
  ENABLE_PLANNER_AFFILIATE_ROUTER,
} from "@/config/featureFlags";
import {
  getAffiliateOfferTokenById,
  recordAffiliateEvent,
} from "@/lib/affiliate/planner/offerRepository";
import { isSafeHttpsUrl } from "@/lib/affiliate/planner/router";

export const dynamic = "force-dynamic";

const tokenSchema = z.string().uuid();

/**
 * GET /r/affiliate/[token]
 * Authoritative click attribution + 302 to server-stored https target.
 * Never accepts client-supplied redirect URLs.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  if (!ENABLE_FREE_TRAVEL_PLANNER || !ENABLE_PLANNER_AFFILIATE_ROUTER) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const { token: raw } = await context.params;
  const parsed = tokenSchema.safeParse(raw?.trim());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid token." }, { status: 400 });
  }

  const row = await getAffiliateOfferTokenById(parsed.data);
  if (!row) {
    return NextResponse.json({ message: "Offer not found." }, { status: 404 });
  }

  if (Date.parse(row.expires_at) < Date.now()) {
    return NextResponse.json({ message: "Offer expired." }, { status: 410 });
  }

  if (!isSafeHttpsUrl(row.target_url)) {
    return NextResponse.json({ message: "Invalid destination." }, { status: 400 });
  }

  await recordAffiliateEvent({
    eventType: "click",
    sessionId: row.planner_session_id,
    providerId: row.provider_id,
    category: row.category,
    placement: row.placement,
    trackingToken: row.id,
    destination: row.destination,
    sourceProductId: row.source_product_id,
    dayNumber: row.day_number,
    itemOrder: row.item_order,
  });

  return NextResponse.redirect(row.target_url, 302);
}
