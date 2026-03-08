/**
 * PR13: 리뷰 리마인더 cron worker.
 * Vercel Cron(5~10분)으로 호출. scheduled_at <= now 이고 status = scheduled 인 건 조회 후
 * executeReminderSend 호출, 성공 시 status = sent, sent_at = now.
 */
import { NextResponse } from "next/server";
import { getDueReviewReminders, executeReminderSend } from "@/lib/reviewReminders";

export async function GET(request: Request) {
  const CRON_SECRET = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const due = await getDueReviewReminders(100);
  let sent = 0;
  let failed = 0;

  for (const r of due) {
    try {
      const ok = await executeReminderSend(r.id);
      if (ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    processed: due.length,
    sent,
    failed,
  });
}
