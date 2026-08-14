/**
 * Threads 장기 액세스 토큰을 주 1회 갱신해 수명을 약 60일로 연장합니다.
 * Vercel Cron + `Authorization: Bearer <CRON_SECRET>` 패턴.
 */
import { NextResponse } from "next/server";
import { captureServerException } from "@/lib/observability";
import { sendSlackPlainText } from "@/lib/notifications";
import { runThreadsTokenRefresh } from "@/lib/threads/refreshThreadsToken";

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
    const result = await runThreadsTokenRefresh();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    captureServerException(err, { cron: "threads-refresh-token" });
    const msg = err instanceof Error ? err.message : String(err);
    await sendSlackPlainText(`[cron/threads-refresh-token] 토큰 갱신 실패: ${msg}`);
    return NextResponse.json({ ok: false, message: "Cron batch failed", detail: msg }, { status: 500 });
  }
}
