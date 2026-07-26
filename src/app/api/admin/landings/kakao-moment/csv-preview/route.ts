import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { previewKakaoMomentCsv } from "@/lib/adminLandings/kakaoMomentImportService";

export const runtime = "nodejs";

type Body = { csvText?: string };

/** POST /api/admin/landings/kakao-moment/csv-preview */
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
  if (!csvText) {
    return NextResponse.json({ error: "csvText가 필요합니다." }, { status: 400 });
  }

  try {
    const result = previewKakaoMomentCsv(csvText);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "CSV 파싱 실패" },
      { status: 400 },
    );
  }
}
