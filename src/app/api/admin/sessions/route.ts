import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { resolveAdminUserKey } from "@/lib/adminPushSubscriptions";
import { listAdminSessionsForUser } from "@/lib/adminSessionStore";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const adminUserKey = resolveAdminUserKey(auth.session);
    const sessions = await listAdminSessionsForUser(adminUserKey, auth.session.sessionId);
    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ message: "세션 목록 조회에 실패했습니다." }, { status: 500 });
  }
}
