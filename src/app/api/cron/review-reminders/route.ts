/**
 * PR13: 리뷰 리마인더 cron worker.
 * Vercel Cron(5~10분)으로 호출. scheduled_at <= now 이고 status = scheduled 인 건 조회 후
 * executeReminderSend 호출, 성공 시 status = sent, sent_at = now.
 */
import { NextResponse } from "next/server";
import { getDueReviewReminders, executeReminderSend } from "@/lib/reviewReminders";
import { sendSlackPlainText } from "@/lib/notifications";
import { captureServerException } from "@/lib/observability";

function isProductionRuntime() {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
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

  let due: Awaited<ReturnType<typeof getDueReviewReminders>> = [];
  let sent = 0;
  let failed = 0;

  try {
    due = await getDueReviewReminders(100);

    for (const r of due) {
      try {
        const ok = await executeReminderSend(r.id);
        if (ok) sent++;
        else failed++;
      } catch (err) {
        failed++;
        captureServerException(err, { cron: "review-reminders", reminderId: String(r.id) });
      }
    }
  } catch (err) {
    captureServerException(err, { cron: "review-reminders", phase: "batch" });
    const msg = err instanceof Error ? err.message : String(err);
    await sendSlackPlainText(`[cron/review-reminders] 배치 실패: ${msg}`);
    return NextResponse.json({ message: "Cron batch failed", detail: msg }, { status: 500 });
  }

  if (failed > 0) {
    const summary = `[cron/review-reminders] 일부 실패 — processed=${due.length} sent=${sent} failed=${failed}`;
    await sendSlackPlainText(summary);
    captureServerException(new Error("review-reminders partial failures"), {
      processed: due.length,
      sent,
      failed,
    });
  }

  return NextResponse.json({
    processed: due.length,
    sent,
    failed,
  });
}
