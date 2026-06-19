import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcEarnPointsAmount, parseSimpleCsvRows } from "@/server/services/points/earnRequests";

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
    const { data: reqs } = await supabaseAdmin
      .from("point_earn_requests")
      .select("id, booking_ref, status, traveler_count")
      .in("booking_ref", bookingRefs);

    const map = new Map(
      (reqs ?? []).map((r: { id: string; booking_ref: string; status: string; traveler_count: number }) => [
        r.booking_ref,
        r,
      ]),
    );

    const preview = rows.map((row) => {
      const matched = map.get(row.booking_ref);
      const travelerCount = matched ? Number(matched.traveler_count) : 0;
      const computedAmount = matched ? calcEarnPointsAmount(travelerCount) : 0;
      const canApply = Boolean(matched && matched.status === "REQUESTED" && travelerCount >= 1);
      return {
        ...row,
        requestId: matched?.id ?? null,
        requestStatus: matched?.status ?? null,
        traveler_count: travelerCount,
        computed_amount: computedAmount,
        canApply,
        reason: !matched
          ? "요청 없음"
          : matched.status !== "REQUESTED"
            ? `요청 상태 ${matched.status}`
            : travelerCount < 1
              ? "traveler_count 오류"
              : "OK",
      };
    });

    return NextResponse.json({ rows: preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV 파싱 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}
