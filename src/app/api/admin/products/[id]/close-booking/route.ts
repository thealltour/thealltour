import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  closeProductBooking,
  CloseProductBookingError,
} from "@/lib/admin/closeProductBooking";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const productId = id?.trim() ?? "";
  if (!productId) {
    return NextResponse.json({ message: "상품 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const result = await closeProductBooking(productId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CloseProductBookingError) {
      return NextResponse.json({ message: error.message }, { status: error.httpStatus });
    }
    return NextResponse.json({ message: "예약마감 처리에 실패했습니다." }, { status: 500 });
  }
}
