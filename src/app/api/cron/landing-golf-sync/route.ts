/**
 * 신규 골프 상품이 등록된 지역에 골프 랜딩 draft가 없으면 자동 생성합니다.
 * Vercel Cron + `Authorization: Bearer <CRON_SECRET>` 패턴.
 */
import { NextResponse } from "next/server";
import { syncMissingGolfDestinationLandingDrafts } from "@/lib/adminLandings/golfLandingSync";
import { captureServerException } from "@/lib/observability";
import { sendSlackPlainText } from "@/lib/notifications";

function isProductionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";

  if (isProductionRuntime()) {
    if (!cronSecret) {
      return NextResponse.json(
        { message: "Cron disabled: CRON_SECRET is not configured in production." },
        { status: 401 },
      );
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncMissingGolfDestinationLandingDrafts();
    return NextResponse.json({
      created: result.created.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
      detail: result,
    });
  } catch (err) {
    captureServerException(err, { cron: "landing-golf-sync" });
    const msg = err instanceof Error ? err.message : String(err);
    await sendSlackPlainText(`[cron/landing-golf-sync] 배치 실패: ${msg}`);
    return NextResponse.json({ message: "Cron batch failed", detail: msg }, { status: 500 });
  }
}
