import { sanitizeTossProductImageUrl } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingImage";
import { TOSS_TRAVEL_GOODS_INTENTS } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import type {
  AffiliateOfferEsimMetadata,
  AffiliateOfferTravelGoodsMetadata,
} from "@/lib/affiliate/planner/types";

const ESIM_DATA_LABEL_PATTERN = /^(?:\d+(?:\.\d+)?(?:GB|MB)|Unlimited)$/;
const ESIM_VALIDITY_DAYS_MAX = 365;
const TRAVEL_GOODS_INTENT_SET = new Set<string>(TOSS_TRAVEL_GOODS_INTENTS);

/**
 * Whitelist eSIM plan facts before they reach the client DTO.
 * Returns null when nothing valid remains, so offers without plan facts carry no `esim` key.
 */
export function sanitizeAffiliateEsimMetadata(
  raw: AffiliateOfferEsimMetadata | null | undefined,
): AffiliateOfferEsimMetadata | null {
  if (!raw) return null;
  const dataLabel =
    typeof raw.dataLabel === "string" && ESIM_DATA_LABEL_PATTERN.test(raw.dataLabel)
      ? raw.dataLabel
      : null;
  const validityDays =
    typeof raw.validityDays === "number" &&
    Number.isInteger(raw.validityDays) &&
    raw.validityDays >= 1 &&
    raw.validityDays <= ESIM_VALIDITY_DAYS_MAX
      ? raw.validityDays
      : null;
  if (dataLabel == null && validityDays == null) return null;
  return { dataLabel, validityDays };
}

/** "10GB · 30일" / "10GB" / "30일"; null when there is nothing to show. */
export function formatAffiliateEsimMetadataLine(
  raw: AffiliateOfferEsimMetadata | null | undefined,
): string | null {
  const esim = sanitizeAffiliateEsimMetadata(raw);
  if (!esim) return null;
  const parts: string[] = [];
  if (esim.dataLabel) parts.push(esim.dataLabel === "Unlimited" ? "무제한" : esim.dataLabel);
  if (esim.validityDays != null) parts.push(`${esim.validityDays}일`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Whitelist travel-goods facts before they reach the client DTO.
 * Prices are never accepted. Invalid image hosts are dropped (card still works).
 */
export function sanitizeAffiliateTravelGoodsMetadata(
  raw: AffiliateOfferTravelGoodsMetadata | null | undefined,
): AffiliateOfferTravelGoodsMetadata | null {
  if (!raw) return null;
  const intent = typeof raw.intent === "string" ? raw.intent.trim() : "";
  if (!TRAVEL_GOODS_INTENT_SET.has(intent)) return null;
  const imageUrl = sanitizeTossProductImageUrl(raw.imageUrl ?? null);
  return imageUrl ? { intent, imageUrl } : { intent };
}
