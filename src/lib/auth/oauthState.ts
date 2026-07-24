import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthMode, AuthProviderId } from "@/lib/auth/types";
import type { MemberAcquisition } from "@/lib/auth/memberAcquisition";

export const OAUTH_STATE_COOKIE = "theall_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthStatePayload = {
  provider: AuthProviderId;
  mode: AuthMode;
  next: string;
  nonce: string;
  memberId?: string;
  acquisition?: MemberAcquisition | null;
  expiresAt: number;
};

function getStateSecret(): string {
  return process.env.MEMBER_SESSION_SECRET ?? "";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payloadBase64: string) {
  const secret = getStateSecret();
  if (!secret) throw new Error("MEMBER_SESSION_SECRET 환경변수가 필요합니다.");
  return createHmac("sha256", secret).update(payloadBase64).digest("base64url");
}

export function createOAuthStateToken(payload: Omit<OAuthStatePayload, "nonce" | "expiresAt">): string {
  const full: OAuthStatePayload = {
    ...payload,
    nonce: randomBytes(16).toString("hex"),
    expiresAt: Date.now() + STATE_TTL_MS,
  };
  const payloadBase64 = toBase64Url(JSON.stringify(full));
  return `${payloadBase64}.${sign(payloadBase64)}`;
}

export function verifyOAuthStateToken(token?: string | null): OAuthStatePayload | null {
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
    const parsed = JSON.parse(fromBase64Url(payloadBase64)) as Partial<OAuthStatePayload>;
    if (!parsed.provider || !parsed.mode || !parsed.next || !parsed.nonce || !parsed.expiresAt) {
      return null;
    }
    if (parsed.expiresAt < Date.now()) return null;
    return parsed as OAuthStatePayload;
  } catch {
    return null;
  }
}

export const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: Math.floor(STATE_TTL_MS / 1000),
};
