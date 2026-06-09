import { cookies } from "next/headers";
import { ADMIN_AUTH_COOKIE } from "@/lib/adminAuth";
import { verifyAdminSessionToken, type AdminSessionPayload } from "@/lib/adminSession";

/** 서버 컴포넌트·layout에서 관리자 세션 조회 */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

/** @deprecated getAdminSession().role 사용 */
export async function getAdminSessionRole() {
  const session = await getAdminSession();
  return session?.role ?? null;
}
