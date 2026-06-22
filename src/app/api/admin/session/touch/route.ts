import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { touchAdminSession } from "@/lib/adminSessionStore";

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const sessionId = auth.session.sessionId;
  if (!sessionId) {
    return NextResponse.json({ message: "유효하지 않은 세션입니다." }, { status: 401 });
  }

  try {
    await touchAdminSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "세션 갱신에 실패했습니다." }, { status: 500 });
  }
}
