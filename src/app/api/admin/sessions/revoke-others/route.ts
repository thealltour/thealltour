import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { resolveAdminUserKey } from "@/lib/adminPushSubscriptions";
import { revokeAllAdminSessions } from "@/lib/adminSessionStore";

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const adminUserKey = resolveAdminUserKey(auth.session);
    const revokedCount = await revokeAllAdminSessions(adminUserKey, auth.session.sessionId);
    return NextResponse.json({
      message: "다른 기기의 로그인이 모두 해제되었습니다.",
      revokedCount,
    });
  } catch {
    return NextResponse.json({ message: "다른 기기 로그아웃에 실패했습니다." }, { status: 500 });
  }
}
