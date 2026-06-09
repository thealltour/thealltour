/** httpOnly 쿠키 값 — JWT 문자열([`adminSession`](./adminSession.ts)). */
export const ADMIN_AUTH_COOKIE = "theall_admin_auth";

export function getAdminId() {
  return process.env.ADMIN_ID?.trim();
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim();
}

/** 총괄(부트스트랩) 어드민 env 자격 확인 */
export function isBootstrapAdminCredentials(id: string, password: string): boolean {
  const adminId = getAdminId();
  const adminPassword = getAdminPassword();
  if (!adminId || !adminPassword) return false;
  return id.trim() === adminId && password.trim() === adminPassword;
}

export function hasBootstrapAdminConfigured(): boolean {
  return Boolean(getAdminId() && getAdminPassword());
}
