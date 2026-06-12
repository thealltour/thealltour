import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getSmsThreadByPhone, markSmsThreadReadByPhone } from "@/lib/sms/smsConversations";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const phone = url.searchParams.get("phone")?.trim() ?? "";

  if (!phone) {
    return NextResponse.json({ message: "phone 파라미터가 필요합니다." }, { status: 400 });
  }

  const result = await getSmsThreadByPhone(phone);
  if (!result) {
    return NextResponse.json({ message: "유효하지 않은 전화번호입니다." }, { status: 400 });
  }

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const phone = url.searchParams.get("phone")?.trim() ?? "";

  if (!phone) {
    return NextResponse.json({ message: "phone 파라미터가 필요합니다." }, { status: 400 });
  }

  const result = await markSmsThreadReadByPhone(phone);
  if (!result.ok) {
    return NextResponse.json({ message: "열람 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, read_at: result.read_at });
}
