import { createHmac, timingSafeEqual } from "node:crypto";

export const MEMBER_AUTH_COOKIE = "theall_member_auth";

export type MemberSessionPayload = {
  memberId: string;
  username: string;
  name: string;
};

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

function getMemberSessionSecret() {
  return process.env.MEMBER_SESSION_SECRET ?? "";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payloadBase64: string) {
  const secret = getMemberSessionSecret();
  if (!secret) {
    throw new Error("MEMBER_SESSION_SECRET 환경변수가 필요합니다.");
  }
  return createHmac("sha256", secret).update(payloadBase64).digest("base64url");
}

export function createMemberSessionToken(payload: MemberSessionPayload) {
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function verifyMemberSessionToken(token?: string | null): MemberSessionPayload | null {
  if (!token) return null;
  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;

  let expectedSignature = "";
  try {
    expectedSignature = sign(payloadBase64);
  } catch {
    return null;
  }

  const a = Buffer.from(signature, "base64url");
  const b = Buffer.from(expectedSignature, "base64url");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payloadBase64)) as Partial<MemberSessionPayload>;
    if (!parsed.memberId || !parsed.username || !parsed.name) return null;
    return {
      memberId: parsed.memberId,
      username: parsed.username,
      name: parsed.name,
    };
  } catch {
    return null;
  }
}

export function getMemberSessionFromCookies(cookies: CookieReader) {
  const token = cookies.get(MEMBER_AUTH_COOKIE)?.value;
  return verifyMemberSessionToken(token);
}
