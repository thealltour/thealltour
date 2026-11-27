import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminServerSession";
import { isSessionAllowedForApiPath } from "@/lib/adminRolePolicy";

/**
 * Route-level gate for inquiry admin APIs.
 * Complements edge proxy auth (Next 16 may not always invoke deprecated middleware).
 */
export async function requireInquiriesApiAccess(): Promise<NextResponse | null> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  if (!isSessionAllowedForApiPath(session, "/api/inquiries")) {
    return NextResponse.json({ message: "이 작업에 대한 권한이 없습니다." }, { status: 403 });
  }
  return null;
}
