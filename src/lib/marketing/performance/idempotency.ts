import { createHash } from "node:crypto";

export function buildObservationBucket(observedAt: string, bucketHours = 6): string {
  const ms = Date.parse(observedAt);
  if (!Number.isFinite(ms)) return "invalid";
  const bucketMs = bucketHours * 60 * 60 * 1000;
  const bucketStart = Math.floor(ms / bucketMs) * bucketMs;
  return new Date(bucketStart).toISOString();
}

export function buildLogicalObservationKey(input: {
  candidateId: string;
  reviewId: string;
  platform: string;
  externalPostId?: string | null;
  externalUrl?: string | null;
  observedAt: string;
  bucketHours?: number;
}): string {
  const externalRef = input.externalPostId?.trim() || input.externalUrl?.trim() || "no-ref";
  const bucket = buildObservationBucket(input.observedAt, input.bucketHours ?? 6);
  const raw = [
    input.candidateId,
    input.reviewId,
    input.platform.trim().toLowerCase(),
    externalRef,
    bucket,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function buildCollectionId(prefix = "pcol"): string {
  const suffix = createHash("sha256")
    .update(`${prefix}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 16);
  return `${prefix}_${suffix}`;
}
