import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { buildInquiryDashboardPayload } from "@/lib/inquiries/inquiryDashboardData";
import type { InquiryDashboardPeriod } from "@/components/admin/inquiries/dashboard/inquiryDashboard.types";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const p = url.searchParams.get("period");
  const period: InquiryDashboardPeriod = p === "30d" ? "30d" : "7d";

  try {
    const payload = await buildInquiryDashboardPayload(period);
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[inquiries/dashboard]", e);
    return NextResponse.json({ message: "대시보드 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}
