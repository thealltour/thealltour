import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { applyKakaoMomentCsv } from "@/lib/adminLandings/kakaoMomentImportService";

export const runtime = "nodejs";

type Body = {
  csvText?: string;
  periodStart?: string;
  periodEnd?: string;
  filename?: string;
};

/** POST /api/admin/landings/kakao-moment/csv-apply */
export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const csvText = body.csvText?.trim() ?? "";
  const periodStart = body.periodStart?.trim() ?? "";
  const periodEnd = body.periodEnd?.trim() ?? "";
  if (!csvText || !periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "csvText, periodStart, periodEnd가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const result = await applyKakaoMomentCsv({
      csvText,
      periodStart,
      periodEnd,
      filename: body.filename?.trim() || "moment.csv",
      uploadedBy: auth.session.username ?? auth.session.adminUserId ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/admin/landings/kakao-moment/csv-apply]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "CSV 적용 실패" },
      { status: 400 },
    );
  }
}
