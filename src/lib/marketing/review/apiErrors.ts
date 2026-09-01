import { NextResponse } from "next/server";
import { HumanReviewTransitionError, HumanReviewPolicyError } from "@/lib/marketing/review/transitions";

export function humanReviewErrorResponse(error: unknown): NextResponse {
  if (error instanceof HumanReviewTransitionError) {
    return NextResponse.json({ message: error.message }, { status: 409 });
  }
  if (error instanceof HumanReviewPolicyError) {
    return NextResponse.json({ message: error.message }, { status: 422 });
  }
  const message = error instanceof Error ? error.message : "unknown_error";
  if (message === "candidate_not_found") {
    return NextResponse.json({ message: "후보를 찾을 수 없습니다." }, { status: 404 });
  }
  if (message === "diagnostics_only_candidate" || message === "review_not_editable") {
    return NextResponse.json({ message: "이 후보는 편집할 수 없습니다." }, { status: 422 });
  }
  if (message === "must_be_approved_before_manual_publication_record") {
    return NextResponse.json({ message: "수동 게시 기록 전에 승인이 필요합니다." }, { status: 422 });
  }
  return NextResponse.json({ message: "요청 처리에 실패했습니다." }, { status: 500 });
}
