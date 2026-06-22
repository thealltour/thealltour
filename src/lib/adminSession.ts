import { SignJWT, jwtVerify } from "jose";
import type { AdminRole } from "@/types/adminRole";
import {
  deriveLegacyRoleFromPermissions,
  type AdminSessionPermissions,
} from "@/lib/adminPermissions";
import { ADMIN_SESSION_JWT_MAX_AGE_SEC } from "@/lib/adminSessionPolicy";

export type AdminSessionPayload = AdminSessionPermissions & {
  sessionId?: string;
};

const VALID_ROLES: readonly AdminRole[] = ["admin", "manager", "viewer"];

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

function parseAdminRole(value: unknown): AdminRole | null {
  if (typeof value !== "string") return null;
  return VALID_ROLES.includes(value as AdminRole) ? (value as AdminRole) : null;
}

function parsePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is string => typeof p === "string");
}

export function parseSessionPayloadFromJwt(
  payload: Record<string, unknown>,
): AdminSessionPayload | null {
  const isBootstrapAdmin = payload.isBootstrapAdmin === true;
  const permissions = parsePermissions(payload.permissions);
  const roleFromJwt = parseAdminRole(payload.role);
  const role =
    roleFromJwt ??
    deriveLegacyRoleFromPermissions(permissions, isBootstrapAdmin);

  const sessionId =
    typeof payload.sid === "string" && payload.sid.trim()
      ? payload.sid.trim()
      : undefined;

  return {
    role,
    permissions: isBootstrapAdmin ? ["*"] : permissions,
    isBootstrapAdmin,
    adminUserId: typeof payload.adminUserId === "string" ? payload.adminUserId : undefined,
    username: typeof payload.username === "string" ? payload.username : undefined,
    sessionId,
  };
}

export async function createAdminSessionToken(
  session: AdminSessionPayload,
  sessionId: string,
): Promise<string> {
  const secret = getAdminJwtSecretBytes();
  if (secret.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET이 없거나 너무 짧습니다. UTF-8 기준 32바이트 이상의 무작위 문자열을 .env에 설정하세요.",
    );
  }

  return new SignJWT({
    role: session.role,
    permissions: session.permissions,
    isBootstrapAdmin: session.isBootstrapAdmin,
    adminUserId: session.adminUserId,
    username: session.username,
    sid: sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_JWT_MAX_AGE_SEC}s`)
    .sign(secret);
}

/** JWT 서명·만료만 검증 (DB 세션 검증 전 단계, Edge 호환) */
export async function verifyAdminSessionJwt(
  token: string | undefined | null,
): Promise<AdminSessionPayload | null> {
  if (!token?.trim()) return null;
  const secret = getAdminJwtSecretBytes();
  if (secret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return parseSessionPayloadFromJwt(payload as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * JWT만 검증 — sid 없는 레거시 토큰은 null.
 * DB 검증이 필요하면 resolveAdminSessionFromToken(adminSessionStore) 사용.
 */
export async function verifyAdminSessionToken(
  token: string | undefined | null,
): Promise<AdminSessionPayload | null> {
  const jwtPayload = await verifyAdminSessionJwt(token);
  if (!jwtPayload?.sessionId) return null;
  return jwtPayload;
}
