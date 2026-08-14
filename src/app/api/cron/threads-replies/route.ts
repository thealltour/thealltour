/**
 * Threads 키워드 댓글에 UTM 상품 링크 자동 답글.
 * Vercel Cron + `Authorization: Bearer <CRON_SECRET>` 패턴.
 */
import { NextResponse } from "next/server";
import { captureServerException } from "@/lib/observability";
import { sendSlackPlainText } from "@/lib/notifications";
import { processThreadKeywordReplies } from "@/lib/threads/processThreadKeywordReplies";
import { THREAD_REPLY_GAP_MS } from "@/lib/threads/replyTemplates";

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
    const result = await processThreadKeywordReplies({
      sleepBetweenReplies: () =>
        new Promise((resolve) => {
          setTimeout(resolve, THREAD_REPLY_GAP_MS);
        }),
    });
    return NextResponse.json(result);
  } catch (err) {
    captureServerException(err, { cron: "threads-replies" });
    const msg = err instanceof Error ? err.message : String(err);
    await sendSlackPlainText(`[cron/threads-replies] 배치 실패: ${msg}`);
    return NextResponse.json({ message: "Cron batch failed", detail: msg }, { status: 500 });
  }
}
