/**
 * 마이페이지 리뷰 섹션 데이터 조회.
 * writable / drafts / submitted 3섹션 데이터를 한 번에 조회.
 * 서버 컴포넌트에서 사용.
 */
import "server-only";

import { getWritableEligibilitiesByMemberId } from "@/lib/reviewEligibilities";
import {
  getDraftReviewsByMemberId,
  getSubmittedReviewsByMemberId,
  getReviewByEligibilityId,
} from "@/lib/reviews";
import type {
  MyPageWritableReviewItem,
  MyPageDraftReviewItem,
  MyPageSubmittedReviewItem,
} from "@/types/review";

export type MyPageReviewSections = {
  writable: MyPageWritableReviewItem[];
  drafts: MyPageDraftReviewItem[];
  submitted: MyPageSubmittedReviewItem[];
};

/**
 * 마이페이지 리뷰 3섹션 데이터 조회.
 * - writable: 작성 가능한 후기 (eligibility 기반, 아직 제출 안 된 것)
 * - drafts: 작성 중인 후기 (현재 DB에 status 컬럼 없어서 항상 빈 배열)
 * - submitted: 작성 완료 후기 (기존 member_id 기준 리뷰)
 */
export async function getMyPageReviewSections(
  memberId: string,
): Promise<MyPageReviewSections> {
  if (!memberId) {
    return { writable: [], drafts: [], submitted: [] };
  }

  const [eligibilities, draftReviews, submittedReviews] = await Promise.all([
    getWritableEligibilitiesByMemberId(memberId),
    getDraftReviewsByMemberId(memberId),
    getSubmittedReviewsByMemberId(memberId),
  ]);

  const writableItems: MyPageWritableReviewItem[] = [];
  for (const elig of eligibilities) {
    const existingReview = await getReviewByEligibilityId(elig.id);
    if (!existingReview) {
      writableItems.push({
        eligibility_id: elig.id,
        booking_id: elig.booking_id,
        customer_profile_id: elig.customer_profile_id,
        product_id: elig.product_id,
        product_title: elig.product_title,
        departure_date: elig.departure_date,
        return_date: elig.return_date,
        review_open_at: elig.review_open_at,
        has_submitted_review: false,
      });
    }
  }

  const draftItems: MyPageDraftReviewItem[] = draftReviews.map((r) => ({
    review_id: r.id,
    eligibility_id: r.eligibility_id,
    title: r.title || null,
    updated_at: r.created_at,
    created_at: r.created_at,
  }));

  const submittedItems: MyPageSubmittedReviewItem[] = submittedReviews.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    created_at: r.created_at,
    rating: r.rating,
    image_urls: r.image_urls,
  }));

  return {
    writable: writableItems,
    drafts: draftItems,
    submitted: submittedItems,
  };
}
