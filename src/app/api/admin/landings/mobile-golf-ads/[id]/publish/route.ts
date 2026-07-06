import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  MobileGolfAdServiceError,
  publishAdminMobileGolfAd,
} from "@/lib/adminMobileGolfAds/service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  try {
    const item = await publishAdminMobileGolfAd(id);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof MobileGolfAdServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "발행에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
