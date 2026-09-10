/**
 * Opaque HMAC-signed selection token for SV-5 PICK.
 * Client cannot forge rights/provider/URL fields — server re-verifies signature.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import type { MarketingMediaRightsKind } from "@/lib/marketing/assets/sourceCatalog/types";
import type {
  ShortformFactualMatch,
  ShortformSourceCandidate,
  ShortformSourceCandidateMediaType,
  ShortformSourceCandidateOrigin,
} from "@/lib/marketing/assets/shortform/resolver/contracts";

const TOKEN_TTL_MS = 30 * 60 * 1000;

export type ShortformCandidateSelectionPayload = {
  v: 1;
  candidateId: string;
  sceneId: string;
  candidateKey: string;
  origin: ShortformSourceCandidateOrigin;
  catalogSourceId: string | null;
  provider: string | null;
  providerAssetId: string | null;
  mediaType: ShortformSourceCandidateMediaType;
  sourcePageUrl: string | null;
  remoteAssetUrl: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  orientation: string | null;
  creatorName: string | null;
  rightsKind: MarketingMediaRightsKind;
  licenseName: string | null;
  licenseUrl: string | null;
  attributionText: string | null;
  factualMatch: ShortformFactualMatch;
  score: number;
  expiresAt: number;
};

function getSelectionSecret(): string {
  return (
    process.env.SHORTFORM_CANDIDATE_SELECTION_SECRET?.trim() ||
    process.env.MEMBER_SESSION_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    ""
  );
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payloadBase64: string): string {
  const secret = getSelectionSecret();
  if (!secret) {
    throw new Error("selection_secret_missing");
  }
  return createHmac("sha256", secret).update(payloadBase64).digest("base64url");
}

export function isShortformCandidateSelectionSigningConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    env.SHORTFORM_CANDIDATE_SELECTION_SECRET?.trim() ||
      env.MEMBER_SESSION_SECRET?.trim() ||
      env.ADMIN_SESSION_SECRET?.trim(),
  );
}

export function createShortformCandidateSelectionToken(
  input: Omit<ShortformCandidateSelectionPayload, "v" | "expiresAt"> & { expiresAt?: number },
): string {
  const payload: ShortformCandidateSelectionPayload = {
    ...input,
    v: 1,
    expiresAt: input.expiresAt ?? Date.now() + TOKEN_TTL_MS,
  };
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  return `${payloadBase64}.${sign(payloadBase64)}`;
}

export function verifyShortformCandidateSelectionToken(
  token: string | null | undefined,
): ShortformCandidateSelectionPayload | null {
  if (!token) return null;
  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;
  let expected = "";
  try {
    expected = sign(payloadBase64);
  } catch {
    return null;
  }
  const a = Buffer.from(signature, "base64url");
  const b = Buffer.from(expected, "base64url");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(payloadBase64)) as ShortformCandidateSelectionPayload;
    if (parsed.v !== 1 || !parsed.candidateId || !parsed.sceneId || !parsed.candidateKey) {
      return null;
    }
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function selectionPayloadFromCandidate(input: {
  candidateId: string;
  sceneId: string;
  candidate: ShortformSourceCandidate;
}): Omit<ShortformCandidateSelectionPayload, "v" | "expiresAt"> {
  const c = input.candidate;
  return {
    candidateId: input.candidateId,
    sceneId: input.sceneId,
    candidateKey: c.candidateKey,
    origin: c.origin,
    catalogSourceId: c.catalogSourceId,
    provider: c.provider,
    providerAssetId: c.providerAssetId,
    mediaType: c.mediaType,
    sourcePageUrl: c.sourcePageUrl,
    remoteAssetUrl: c.remoteAssetUrl,
    previewUrl: c.previewUrl,
    width: c.width,
    height: c.height,
    durationMs: c.durationMs,
    orientation: c.orientation,
    creatorName: c.creatorName,
    rightsKind: c.rightsKind,
    licenseName: c.licenseName,
    licenseUrl: c.licenseUrl,
    attributionText: c.attributionText,
    factualMatch: c.factualMatch,
    score: c.score,
  };
}
