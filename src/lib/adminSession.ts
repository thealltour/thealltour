import { SignJWT, jwtVerify } from "jose";

/** 관리자 쿠키 max-age(초) — 기존 admin login과 동일 12h */
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 12;

/**
 * 로컬 `next dev` 전용 — 프로덕션 빌드에서는 사용되지 않습니다.
 * (UTF-8 기준 32바이트 이상)
 */
const DEV_ADMIN_SESSION_SECRET_FALLBACK =
  "__THEALL_LOCAL_DEV_ONLY_ADMIN_SESSION_SECRET_32BYTES_MIN__";

let devAdminSecretFallbackWarned = false;

function isNonProductionNodeEnv() {
  return process.env.NODE_ENV !== "production";
}

function resolveAdminSessionSecretRaw(): string {
  const fromEnv = process.env.ADMIN_SESSION_SECRET?.trim() ?? "";
  if (fromEnv.length > 0) return fromEnv;
  if (isNonProductionNodeEnv()) {
    if (!devAdminSecretFallbackWarned) {
      devAdminSecretFallbackWarned = true;
      console.warn(
        "[adminSession] ADMIN_SESSION_SECRET이 없습니다. 로컬 개발용 기본 시크릿을 씁니다. " +
          "배포·next start 전에는 .env에 32바이트 이상 무작위 값을 넣으세요.",
      );
    }
    return DEV_ADMIN_SESSION_SECRET_FALLBACK;
  }
  return "";
}

function getAdminJwtSecretBytes(): Uint8Array {
  return new TextEncoder().encode(resolveAdminSessionSecretRaw());
}

/**
 * HS256 관리자 세션 JWT 발급.
 * 프로덕션: `ADMIN_SESSION_SECRET` UTF-8 기준 32바이트 이상 필수.
 * `next dev`에서만 미설정 시 개발용 기본 시크릿 사용(콘솔 경고).
 */
export async function createAdminSessionToken(): Promise<string> {
  const secret = getAdminJwtSecretBytes();
  if (secret.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET이 없거나 너무 짧습니다. UTF-8 기준 32바이트 이상의 무작위 문자열을 .env에 설정하세요. (예: openssl rand -base64 32)",
    );
  }
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_MAX_AGE_SEC}s`)
    .sign(secret);
}

/** Edge/Node 공통 — 미들웨어·API에서 동일 검증 */
export async function verifyAdminSessionToken(
  token: string | undefined | null,
): Promise<{ role: "admin" } | null> {
  if (!token?.trim()) return null;
  const secret = getAdminJwtSecretBytes();
  if (secret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (payload.role !== "admin") return null;
    return { role: "admin" };
  } catch {
    return null;
  }
}
