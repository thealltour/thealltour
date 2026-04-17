import { NextResponse } from "next/server";
import { getSiteSettingsLive } from "@/lib/siteSettings";

/** 푸터 등 클라이언트가 매 요청 최신값을 받도록 캐시 비사용 */
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSiteSettingsLive();
  return NextResponse.json(settings, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

