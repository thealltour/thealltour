/**
 * Deterministic marketing publication idempotency keys (PUB-2).
 */

import { createHash } from "node:crypto";

import type { SocialChannel } from "@/lib/marketing/social/domain/providers";

export type MarketingPublicationIdempotencyInput = {
  candidateId: string;
  socialAccountId: string;
  channel: SocialChannel;
  /** TEXT or IMAGE for first Threads adapter */
  mediaType: "TEXT" | "IMAGE";
  text: string;
  imageUrl?: string | null;
};

export function buildMarketingPublicationIdempotencyKey(
  input: MarketingPublicationIdempotencyInput,
): string {
  const candidateId = input.candidateId.trim();
  const socialAccountId = input.socialAccountId.trim();
  if (!candidateId) throw new Error("candidateId required for idempotency key");
  if (!socialAccountId) throw new Error("socialAccountId required for idempotency key");
  const body = JSON.stringify({
    text: input.text.trim(),
    imageUrl: input.imageUrl?.trim() || null,
    mediaType: input.mediaType,
  });
  const digest = createHash("sha256").update(body).digest("hex").slice(0, 24);
  return `mkt-pub:v1:${candidateId}:${socialAccountId}:${input.channel}:${input.mediaType}:${digest}`;
}

export function buildHumanApprovalRef(input: {
  reviewId: string;
  candidateId: string;
}): string {
  const reviewId = input.reviewId.trim();
  const candidateId = input.candidateId.trim();
  if (!reviewId || !candidateId) throw new Error("reviewId and candidateId required");
  return `hmr:${reviewId}:candidate:${candidateId}`;
}
