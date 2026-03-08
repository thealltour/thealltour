import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

type RouteContext = { params: Promise<{ id: string }> };

type PatchBody = { status?: "pending" | "resolved" | "dismissed" };

/** PATCH: 관리자 전용. 신고 상태 변경 (무시: dismissed, 처리완료: resolved). */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: reportId } = await context.params;
  if (!reportId) {
    return NextResponse.json({ message: "신고 ID가 필요합니다." }, { status: 400 });
  }

  let body: PatchBody = {};
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    // no body
  }
  const status = body.status === "resolved" || body.status === "dismissed" ? body.status : "dismissed";

  const { error } = await supabase
    .from("review_reports")
    .update({ status })
    .eq("id", reportId);

  if (error) {
    return NextResponse.json({ message: "신고 상태 변경에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    message: status === "dismissed" ? "신고가 무시 처리되었습니다." : "신고가 처리 완료되었습니다.",
    status,
  });
}
