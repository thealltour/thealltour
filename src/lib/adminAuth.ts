/** httpOnly 쿠키 값 — JWT 문자열([`adminSession`](./adminSession.ts)). 예전 `"1"` 값은 더 이상 유효하지 않습니다. */
export const ADMIN_AUTH_COOKIE = "theall_admin_auth";

export function getAdminId() {
  return process.env.ADMIN_ID;
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD;
}
