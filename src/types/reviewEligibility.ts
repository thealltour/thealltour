/**
 * 후기 작성 자격.
 * 여행건(booking) 기준 생성, 회원 claim 시 claimed_by_member_id 연결.
 */

export type ReviewEligibilityStatus =
  | "eligible"
  | "claimed"
  | "submitted"
  | "expired"
  | "blocked";

export type ReviewEligibility = {
  id: string;
  booking_id: string;
  customer_profile_id: string;
  status: ReviewEligibilityStatus;
  review_open_at: string;
  review_deadline_at: string | null;
  claimed_by_member_id: string | null;
  claimed_at: string | null;
  /** Claim Token: 비로그인 고객이 후기 권한을 연결할 때 사용 */
  claim_token: string | null;
  /** Claim Token 만료 시간 */
  claim_token_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewEligibilityInput = {
  booking_id: string;
  customer_profile_id: string;
  status?: ReviewEligibilityStatus;
  review_open_at?: string;
  review_deadline_at?: string | null;
  /** Claim Token (자동 생성 시 전달) */
  claim_token?: string | null;
  /** Claim Token 만료 시간 */
  claim_token_expires_at?: string | null;
};
