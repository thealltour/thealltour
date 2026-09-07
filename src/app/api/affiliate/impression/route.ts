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

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    trackingToken: z.string().uuid(),
  })
  .strict();

/**
 * POST /api/affiliate/impression
 * Deduped by unique index on tracking_token for impression events.
 */
export async function POST(request: Request) {
  if (!ENABLE_FREE_TRAVEL_PLANNER || !ENABLE_PLANNER_AFFILIATE_ROUTER) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const row = await getAffiliateOfferTokenById(parsed.data.trackingToken);
  if (!row) {
    return NextResponse.json({ message: "Offer not found." }, { status: 404 });
  }

  const result = await recordAffiliateEvent({
    eventType: "impression",
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

  return NextResponse.json({ ok: result.ok, duplicate: Boolean(result.duplicate) });
}
