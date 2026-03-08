/**
 * PR25: 리뷰 작성자 식별 키 추출.
 * - author_id / member_id 우선, fallback으로 author_name 기반 안전 키.
 * - 공개 UI에는 개인식별정보 직접 노출 금지.
 */

export type ReviewForAuthorIdentity = {
  id: string;
  member_id?: string | null;
  author_id?: string | null;
  account_id?: string | null;
  author_name?: string | null;
  [key: string]: unknown;
};

/**
 * 리뷰에서 작성자 식별 키 추출.
 * 우선순위: author_id → member_id → account_id → author_name 정규화 → unknown:<reviewId>
 */
export function getReviewAuthorKey(review: ReviewForAuthorIdentity): string {
  const id = String(review?.id ?? "").trim();
  const memberId = review?.member_id != null ? String(review.member_id).trim() : "";
  const authorId = review?.author_id != null ? String(review.author_id).trim() : "";
  const accountId = review?.account_id != null ? String(review.account_id).trim() : "";
  const name = review?.author_name != null ? String(review.author_name).trim() : "";

  if (authorId) return `author:${authorId}`;
  if (memberId) return `member:${memberId}`;
  if (accountId) return `account:${accountId}`;
  if (name.length >= 1) {
    const safe = name.toLowerCase().replace(/\s+/g, "_").replace(/[^\w가-힣_]/g, "").slice(0, 64);
    return safe ? `name:${safe}` : `unknown:${id}`;
  }
  return `unknown:${id}`;
}

/**
 * 관리자용 표시 이름. 개인정보 과다 노출 없이 내부 식별용.
 */
export function getReviewAuthorDisplayName(review: ReviewForAuthorIdentity): string {
  const memberId = review?.member_id != null ? String(review.member_id).trim() : "";
  const name = review?.author_name != null ? String(review.author_name).trim() : "";
  if (memberId) return "회원";
  if (name.length >= 1) return `${name.slice(0, 1)}***`;
  return "알 수 없음";
}

/**
 * 두 리뷰가 동일 작성자인지 판별.
 */
export function isSameAuthor(
  reviewA: ReviewForAuthorIdentity,
  reviewB: ReviewForAuthorIdentity,
): boolean {
  return getReviewAuthorKey(reviewA) === getReviewAuthorKey(reviewB);
}
