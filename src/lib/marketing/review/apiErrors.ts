import { NextResponse } from "next/server";
import { HumanReviewTransitionError, HumanReviewPolicyError } from "@/lib/marketing/review/transitions";
import { HumanReviewEligibilityError } from "@/lib/marketing/review/bootstrap/humanReviewEligibilityError";

export function humanReviewErrorResponse(error: unknown): NextResponse {
  if (error instanceof HumanReviewTransitionError) {
    return NextResponse.json({ message: error.message }, { status: 409 });
  }
  if (error instanceof HumanReviewPolicyError) {
    return NextResponse.json({ message: error.message }, { status: 422 });
  }
  if (error instanceof HumanReviewEligibilityError) {
    return NextResponse.json({ message: error.message, reason: error.reason }, { status: 422 });
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
  if (message === "review_missing") {
    return NextResponse.json(
      {
        message: "human_review_missing",
        hint: "HumanMarketingReview 레코드가 없습니다. 페이지를 새로고침한 뒤 Body 품질 재생성을 다시 시도하세요.",
      },
      { status: 409 },
    );
  }
  if (message === "content_proposition_missing") {
    return NextResponse.json(
      {
        message: "content_proposition_missing",
        hint: "ContentProposition이 없습니다. Content Strategist 재실행 또는 proposition 백필 후 재생성하세요.",
      },
      { status: 409 },
    );
  }
  if (message === "channel_regenerate_failed" || message.startsWith("channel_regenerate_failed")) {
    return NextResponse.json(
      {
        message: "채널 재생성에 실패했습니다. 이전 본문은 유지됩니다.",
        reason: message,
      },
      { status: 502 },
    );
  }
  if (message.startsWith("regeneration_required")) {
    return NextResponse.json(
      { message: "재생성(LLM)이 필요합니다.", reason: message },
      { status: 409 },
    );
  }
  console.error("[humanReviewErrorResponse]", message, error);
  return NextResponse.json(
    {
      message: "요청 처리에 실패했습니다.",
      reason: message.slice(0, 500),
    },
    { status: 500 },
  );
}
