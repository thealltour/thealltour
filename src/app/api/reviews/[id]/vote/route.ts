import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireMemberSession } from "@/lib/apiAuth";
import { getReviewById } from "@/lib/reviews";

const VOTE_TYPE_HELPFUL = "helpful";

type RouteContext = { params: Promise<{ id: string }> };

type PostBody = { voteType?: string };

/** POST: 도움됨 투표 토글. 로그인 필수. */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const memberId = auth.session.memberId;

  const { id: reviewId } = await context.params;
  if (!reviewId) {
    return NextResponse.json({ message: "리뷰 ID가 필요합니다." }, { status: 400 });
  }

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    // no body
  }
  if (body.voteType !== VOTE_TYPE_HELPFUL) {
    return NextResponse.json(
      { message: "voteType은 'helpful'만 지원합니다." },
      { status: 400 },
    );
  }

  const review = await getReviewById(reviewId);
  if (!review) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }
  if (review.status !== "submitted") {
    return NextResponse.json({ message: "공개된 후기에만 투표할 수 있습니다." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("review_votes")
    .select("id")
    .eq("review_id", reviewId)
    .eq("member_id", memberId)
    .eq("vote_type", VOTE_TYPE_HELPFUL)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("review_votes")
      .delete()
      .eq("review_id", reviewId)
      .eq("member_id", memberId)
      .eq("vote_type", VOTE_TYPE_HELPFUL);
    if (error) {
      return NextResponse.json({ message: "투표 취소에 실패했습니다." }, { status: 500 });
    }
    const { count } = await supabase
      .from("review_votes")
      .select("id", { count: "exact", head: true })
      .eq("review_id", reviewId)
      .eq("vote_type", VOTE_TYPE_HELPFUL);
    return NextResponse.json({
      helpfulCount: count ?? 0,
      voted: false,
    });
  }

  const { error: insertError } = await supabase.from("review_votes").insert({
    review_id: reviewId,
    member_id: memberId,
    vote_type: VOTE_TYPE_HELPFUL,
  });
  if (insertError) {
    return NextResponse.json({ message: "투표에 실패했습니다." }, { status: 500 });
  }

  const { count } = await supabase
    .from("review_votes")
    .select("id", { count: "exact", head: true })
    .eq("review_id", reviewId)
    .eq("vote_type", VOTE_TYPE_HELPFUL);

  return NextResponse.json({
    helpfulCount: count ?? 0,
    voted: true,
  });
}
