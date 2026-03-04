import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";
import { parseSimpleCsvRows } from "@/server/services/points/earnRequests";

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

  try {
    const rows = parseSimpleCsvRows(csvText);
    const bookingRefs = rows.map((r) => r.booking_ref).filter(Boolean);
    const { data: reqs } = await supabase
      .from("point_earn_requests")
      .select("id, booking_ref, status")
      .in("booking_ref", bookingRefs);

    const map = new Map((reqs ?? []).map((r: { id: string; booking_ref: string; status: string }) => [r.booking_ref, r]));
    const preview = rows.map((row) => {
      const matched = map.get(row.booking_ref);
      const validStatus = row.grant_status === "CONFIRMED" || row.grant_status === "PENDING";
      const validAmount = Number.isFinite(row.amount) && row.amount > 0;
      const canApply = Boolean(matched && matched.status === "REQUESTED" && validStatus && validAmount);
      return {
        ...row,
        requestId: matched?.id ?? null,
        requestStatus: matched?.status ?? null,
        canApply,
        reason: !matched
          ? "요청 없음"
          : matched.status !== "REQUESTED"
            ? `요청 상태 ${matched.status}`
            : !validStatus
              ? "grant_status 값 오류"
              : !validAmount
                ? "amount 값 오류"
                : "OK",
      };
    });

    return NextResponse.json({ rows: preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV 파싱 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}
