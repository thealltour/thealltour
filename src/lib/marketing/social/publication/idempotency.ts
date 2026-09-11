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

/**
 * Deterministic idempotency for human-recorded (manual) publications (PUB-4).
 * One published SocialPublication per approved candidate + account + channel.
 */
export function buildManualMarketingPublicationIdempotencyKey(input: {
  candidateId: string;
  socialAccountId: string;
  channel: SocialChannel;
}): string {
  const candidateId = input.candidateId.trim();
  const socialAccountId = input.socialAccountId.trim();
  if (!candidateId) throw new Error("candidateId required for manual idempotency key");
  if (!socialAccountId) throw new Error("socialAccountId required for manual idempotency key");
  return `mkt-manual:v1:${candidateId}:${socialAccountId}:${input.channel}`;
}

/** Normalize external URL for duplicate detection (no secrets). */
export function normalizeExternalPublicationUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    const host = url.host.toLowerCase();
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    const query = url.searchParams.toString();
    return query ? `${url.protocol}//${host}${pathname}?${query}` : `${url.protocol}//${host}${pathname}`;
  } catch {
    return null;
  }
}
