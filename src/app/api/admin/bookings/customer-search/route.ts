import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { searchBookingCustomers } from "@/lib/bookings/searchBookingCustomers";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "15", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 30) : 15;

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await searchBookingCustomers(q, limit);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ message: "고객 검색에 실패했습니다." }, { status: 500 });
  }
}
