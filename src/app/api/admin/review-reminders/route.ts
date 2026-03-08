/**
 * PR13: 관리자 리마인더 목록 API (필터/페이지네이션).
 */
import { NextResponse } from "next/server";
import { getReviewRemindersList } from "@/lib/reviewReminders";
import type { ReviewReminderStatus } from "@/lib/reviewReminders";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as ReviewReminderStatus | null;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const { rows, total } = await getReviewRemindersList({
    status: status ?? undefined,
    limit,
    offset,
  });

  return NextResponse.json({ rows, total });
}
