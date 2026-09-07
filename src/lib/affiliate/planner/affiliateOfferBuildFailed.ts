/**
 * Optional typed soft-fail signal for affiliate offer build failures.
 * No secrets, no raw rollout keys, no client storm (server log only).
 * Prefer impressions for "exposed" monitoring — migration NONE.
 */
export type AffiliateOfferBuildFailedReason =
  | "adapter_error"
  | "commerce_failed"
  | "persist_failed"
  | "unexpected";

export function logAffiliateOfferBuildFailed(params: {
  sessionId: string;
  reason: AffiliateOfferBuildFailedReason;
  providerId?: string;
}): void {
  console.info("[affiliate] offer_build_failed", {
    event: "affiliate_offer_build_failed",
    sessionId: params.sessionId,
    reason: params.reason,
    providerId: params.providerId ?? null,
  });
}
