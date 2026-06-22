import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { resolveAdminUserKey } from "@/lib/adminPushSubscriptions";
import { revokeAdminSession, validateAdminSessionRow } from "@/lib/adminSessionStore";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const sessionId = id?.trim();
  if (!sessionId) {
    return NextResponse.json({ message: "세션 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const row = await validateAdminSessionRow(sessionId);
    if (!row) {
      return NextResponse.json({ message: "세션을 찾을 수 없습니다." }, { status: 404 });
    }

    const adminUserKey = resolveAdminUserKey(auth.session);
    if (row.admin_user_key !== adminUserKey) {
      return NextResponse.json({ message: "이 세션을 해제할 권한이 없습니다." }, { status: 403 });
    }

    await revokeAdminSession(sessionId);
    return NextResponse.json({ message: "세션이 해제되었습니다." });
  } catch {
    return NextResponse.json({ message: "세션 해제에 실패했습니다." }, { status: 500 });
  }
}
