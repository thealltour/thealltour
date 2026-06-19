import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminSession } from "@/lib/apiAuth";
import { getReviewById } from "@/lib/reviews";
import { markProductReviewSummaryStale } from "@/lib/reviewSummaries";
import { getProductIdByBookingId } from "@/lib/bookings/bookingRepository";

type ReviewBody = {
  author_name?: string;
  title?: string;
  content?: string;
  rating?: number;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const body = (await request.json()) as ReviewBody;

  const updates: Record<string, unknown> = {};
  if (body.author_name !== undefined) updates.author_name = body.author_name.trim();
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.content !== undefined) updates.content = body.content.trim();
  if (body.rating !== undefined) {
    const value = Math.round(body.rating);
    if (value >= 1 && value <= 5) {
      updates.rating = value;
    } else {
      return NextResponse.json({ message: "별점은 1점에서 5점 사이로 입력해 주세요." }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const result = await supabaseAdmin.from("reviews").update(updates).eq("id", id).select("id").maybeSingle();
  if (result.error) {
    return NextResponse.json({ message: "후기 수정에 실패했습니다." }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json(
      { message: "후기 수정 권한이 없거나 대상 후기를 찾지 못했습니다." },
      { status: 403 },
    );
  }

  return NextResponse.json({ message: "후기가 수정되었습니다." });
}

type RouteContext = { params: Promise<{ id: string }> };

/** 관리자 전용: 리뷰 완전 삭제 (관련 신고/투표/리워드 등은 DB ON DELETE CASCADE로 정리) */
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const review = await getReviewById(id);
  if (!review) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("reviews").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ message: "후기 삭제에 실패했습니다." }, { status: 500 });
  }

  if (review.booking_id) {
    const productId = await getProductIdByBookingId(review.booking_id);
    if (productId) await markProductReviewSummaryStale(productId);
  }

  return NextResponse.json({ message: "후기가 삭제되었습니다." });
}
