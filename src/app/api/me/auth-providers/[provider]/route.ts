import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/apiAuth";
import { unlinkAuthProvider } from "@/lib/auth/memberAuthService";
import { isAuthProviderId } from "@/lib/auth/providerRegistry";

type RouteContext = { params: Promise<{ provider: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireMemberSession();
  if (!auth.session) return auth.res;

  const { provider } = await context.params;
  if (!isAuthProviderId(provider)) {
    return NextResponse.json({ message: "지원하지 않는 로그인 방식입니다." }, { status: 400 });
  }

  try {
    await unlinkAuthProvider(auth.session.memberId, provider);
    return NextResponse.json({ message: "연결이 해제되었습니다." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "연결 해제에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
