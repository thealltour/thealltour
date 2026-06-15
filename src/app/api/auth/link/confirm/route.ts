import { NextResponse } from "next/server";
import { confirmPendingLink } from "@/lib/auth/memberAuthService";
import { appendMemberSessionCookie } from "@/lib/auth/setMemberSessionCookie";
import { sanitizeNextPath } from "@/lib/auth/redirect";

type Body = {
  pendingId?: string;
  password?: string;
  next?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  const pendingId = body.pendingId?.trim() ?? "";
  const password = body.password ?? "";
  const next = sanitizeNextPath(body.next, "/mypage");

  if (!pendingId || !password) {
    return NextResponse.json({ message: "연결 정보와 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  try {
    const member = await confirmPendingLink(pendingId, password);
    const response = NextResponse.json({ message: "계정이 연결되었습니다.", next });
    appendMemberSessionCookie(response, member);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "계정 연결에 실패했습니다.";
    const status = message.includes("비밀번호") ? 401 : 400;
    return NextResponse.json({ message }, { status });
  }
}
