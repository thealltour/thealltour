import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getPointExpiresAt } from "@/config/rewardPolicy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EARN_REQUEST_MESSAGE_TEMPLATES, parseSimpleCsvRows } from "@/server/services/points/earnRequests";

type Body = { csvText?: string };

type ApproveRpcResult = {
  ledger_id: string;
  amount: number;
  user_id: string;
  booking_ref: string;
  traveler_count: number;
};

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
      if (!row.booking_ref.trim()) {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "booking_ref 없음" });
        continue;
      }

      const { data: earnReq, error: reqErr } = await supabaseAdmin
        .from("point_earn_requests")
        .select("id, user_id, status, booking_ref, traveler_count")
        .eq("booking_ref", row.booking_ref)
        .maybeSingle();

      if (reqErr || !earnReq) {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: "요청 없음" });
        continue;
      }

      const req = earnReq as { id: string; user_id: string; status: string; booking_ref: string; traveler_count: number };
      if (req.status !== "REQUESTED") {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: `요청 상태 ${req.status}` });
        continue;
      }

      const { data, error } = await supabaseAdmin.rpc("approve_point_earn_request", {
        p_request_id: req.id,
        p_admin_memo: row.admin_memo || null,
        p_expires_at: getPointExpiresAt(),
        p_decided_by: "ADMIN",
      });

      if (error) {
        results.push({ rowNo: row.rowNo, booking_ref: row.booking_ref, success: false, message: error.message });
        continue;
      }

      const result = data as ApproveRpcResult;
      const amount = Number(result.amount);
      const travelerCount = Number(result.traveler_count);

      try {
        await supabaseAdmin.from("notifications").insert({
          user_id: req.user_id,
          type: "ADMIN_MESSAGE",
          title: "예약 적립 요청 승인",
          body: EARN_REQUEST_MESSAGE_TEMPLATES.approved(amount, travelerCount),
        });
      } catch {
        // best-effort
      }

      results.push({
        rowNo: row.rowNo,
        booking_ref: row.booking_ref,
        success: true,
        message: `적용 완료 (${travelerCount}명, ${amount.toLocaleString()}P)`,
      });
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
