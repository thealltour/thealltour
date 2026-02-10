export const ADMIN_AUTH_COOKIE = "theall_admin_auth";

export function getAdminId() {
  return process.env.ADMIN_ID;
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD;
}
