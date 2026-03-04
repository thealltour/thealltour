import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";
import { grantPointsToUser } from "@/server/services/points/grantPoints";
import { EARN_REQUEST_MESSAGE_TEMPLATES, parseSimpleCsvRows } from "@/server/services/points/earnRequests";

type Body = { csvText?: string };

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const csvText = body.csvText?.trim() ?? "";
  if (!csvText) {
    return NextResponse.json({ message: "csvText가 필요합니다." }, { status: 400 });
  }

  let rows: ReturnType<typeof parseSimpleCsvRows>;
  try {
    rows = parseSimpleCsvRows(csvText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV 파싱 실패";
    return NextResponse.json({ message }, { status: 400 });
  }

  const results: Array<{ rowNo: number; booking_ref: string; success: boolean; message: string }> = [];

  for (const row of rows) {
    try {
      if (!(row.grant_status === "CONFIRMED" || row.grant_status === "PENDING")) {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "grant_status 오류" });
        continue;
      }
      if (!Number.isFinite(row.amount) || row.amount <= 0) {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "amount 오류" });
        continue;
      }

      const { data: earnReq, error: reqErr } = await supabase
        .from("point_earn_requests")
        .select("id, user_id, status, booking_ref")
        .eq("booking_ref", row.booking_ref)
        .maybeSingle();

      if (reqErr || !earnReq) {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "요청 없음" });
        continue;
      }
      const req = earnReq as { id: string; user_id: string; status: string; booking_ref: string };
      if (req.status !== "REQUESTED") {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: `요청 상태 ${req.status}` });
        continue;
      }

      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("point_earn_requests")
        .update({
          status: "APPROVED",
          admin_memo: row.admin_memo || null,
          decided_at: now,
          decided_by_admin_id: "ADMIN",
        })
        .eq("id", req.id)
        .eq("status", "REQUESTED");

      if (updateErr) {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "상태 변경 실패" });
        continue;
      }

      try {
        await grantPointsToUser({
          userId: req.user_id,
          amount: row.amount,
          status: row.grant_status as "CONFIRMED" | "PENDING",
          reason: `CSV 적립 요청 승인 (${req.booking_ref})`,
          refType: "EARN_REQUEST",
          refId: req.id,
          actorAdminId: "ADMIN",
        });

        await supabase.from("notifications").insert({
          user_id: req.user_id,
          type: "ADMIN_MESSAGE",
          title: "예약 적립 요청 승인",
          body:
            row.grant_status === "CONFIRMED"
              ? EARN_REQUEST_MESSAGE_TEMPLATES.approved(row.amount)
              : EARN_REQUEST_MESSAGE_TEMPLATES.pending(row.amount),
        });

        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: true, message: "적용 완료" });
      } catch (error) {
        await supabase
          .from("point_earn_requests")
          .update({
            status: "REQUESTED",
            admin_memo: null,
            decided_at: null,
            decided_by_admin_id: null,
          })
          .eq("id", req.id);

        const msg = error instanceof Error ? error.message : "포인트 지급 실패";
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: msg });
      }
    } catch {
      results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "처리 중 오류" });
    }
  }

  return NextResponse.json({
    total: rows.length,
    successCount: results.filter((r) => r.success).length,
    failCount: results.filter((r) => !r.success).length,
    results,
  });
}
