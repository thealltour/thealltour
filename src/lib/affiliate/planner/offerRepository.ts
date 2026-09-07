import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AffiliateOffer, AffiliateOfferBuild } from "@/lib/affiliate/planner/types";

type TokenRow = {
  id: string;
  planner_session_id: string;
  provider_id: string;
  category: string;
  placement: string;
  target_url: string;
  title: string;
  description: string | null;
  cta_label: string;
  destination: string | null;
  source_product_id: string | null;
  day_number: number | null;
  item_order: number | null;
  expires_at: string;
};

export async function persistAffiliateOfferToken(params: {
  sessionId: string;
  build: AffiliateOfferBuild;
  destination: string | null;
  sourceProductId: string | null;
}): Promise<AffiliateOffer | null> {
  const { build } = params;
  const { data, error } = await supabaseAdmin
    .from("affiliate_offer_tokens")
    .insert({
      planner_session_id: params.sessionId,
      provider_id: build.providerId,
      category: build.category,
      placement: build.placement,
      target_url: build.targetUrl,
      title: build.title,
      description: build.description,
      cta_label: build.ctaLabel,
      destination: params.destination,
      source_product_id: params.sourceProductId,
      day_number: build.dayNumber ?? null,
      item_order: build.itemOrder ?? null,
    })
    .select(
      "id, provider_id, category, placement, title, description, cta_label, destination, day_number, item_order",
    )
    .single();

  if (error || !data) {
    console.error("[affiliate] persistOfferToken:", error?.message);
    return null;
  }

  const row = data as {
    id: string;
    provider_id: string;
    category: string;
    placement: string;
    title: string;
    description: string | null;
    cta_label: string;
    destination: string | null;
    day_number: number | null;
    item_order: number | null;
  };

  return {
    offerId: row.id,
    providerId: row.provider_id,
    category: row.category as AffiliateOffer["category"],
    placement: row.placement as AffiliateOffer["placement"],
    title: row.title,
    description: row.description,
    ctaLabel: row.cta_label,
    destinationLabel: row.destination,
    trackingToken: row.id,
    metadata:
      row.day_number != null || row.item_order != null
        ? {
            dayNumber: row.day_number ?? undefined,
            itemOrder: row.item_order ?? undefined,
          }
        : undefined,
  };
}

export async function getAffiliateOfferTokenById(
  token: string,
): Promise<TokenRow | null> {
  const { data, error } = await supabaseAdmin
    .from("affiliate_offer_tokens")
    .select(
      "id, planner_session_id, provider_id, category, placement, target_url, title, description, cta_label, destination, source_product_id, day_number, item_order, expires_at",
    )
    .eq("id", token)
    .maybeSingle();

  if (error || !data) return null;
  return data as TokenRow;
}

export async function recordAffiliateEvent(params: {
  eventType: "impression" | "click";
  sessionId: string | null;
  memberId?: string | null;
  providerId: string;
  category: string;
  placement: string;
  trackingToken: string | null;
  destination: string | null;
  sourceProductId: string | null;
  dayNumber: number | null;
  itemOrder: number | null;
}): Promise<{ ok: boolean; duplicate?: boolean }> {
  const { error } = await supabaseAdmin.from("affiliate_events").insert({
    event_type: params.eventType,
    planner_session_id: params.sessionId,
    member_id: params.memberId ?? null,
    provider_id: params.providerId,
    category: params.category,
    placement: params.placement,
    tracking_token: params.trackingToken,
    destination: params.destination,
    source_product_id: params.sourceProductId,
    day_number: params.dayNumber,
    item_order: params.itemOrder,
  });

  if (error) {
    // Unique impression dedupe
    if (params.eventType === "impression" && error.code === "23505") {
      return { ok: true, duplicate: true };
    }
    console.error("[affiliate] recordEvent:", error.message);
    return { ok: false };
  }
  return { ok: true };
}
