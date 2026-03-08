/**
 * PR19: 관리자 리뷰 목록용 데이터 로더.
 * - analytics와 동일한 submitted 리뷰 풀 사용.
 * - PR21: Trust Score 부여.
 */
import "server-only";

import { getAllReviewsForAnalytics } from "@/lib/reviewAnalytics";
import { addTrustScoresToReviews } from "@/lib/reviewTrustScore";

/**
 * 관리자 리뷰 검색/필터 목록용 전체 리뷰 로드.
 * id, product_id, rating, helpfulCount, content, created_at, eligibility_id, image_urls, title, author_name, trustScore 등 포함.
 */
export async function getAllReviewsForAdminList() {
  const reviews = await getAllReviewsForAnalytics();
  return addTrustScoresToReviews(reviews);
}
