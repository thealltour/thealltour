/**
 * 리뷰 상태.
 * - draft: 임시저장
 * - submitted: 제출 완료
 * - hidden: 숨김 처리
 */
export type ReviewStatus = "draft" | "submitted" | "hidden";

export type Review = {
  id: string;
  member_id?: string;
  title: string;
  content: string;
  image_url?: string;
  image_urls?: string[];
  author_name: string;
  created_at?: string;
  updated_at?: string;
  rating?: number;
  /**
   * 리뷰 상태.
   * DB에 status 컬럼이 없으면 undefined이며, 기존 리뷰는 submitted로 간주.
   */
  status?: ReviewStatus;
  /** eligibility 기반 확장용 */
  eligibility_id?: string;
  booking_id?: string;
  customer_profile_id?: string;

  /** PR5: 여행 후기형 확장 필드 */
  summary?: string;
  content_good?: string;
  content_bad?: string;
  content_tip?: string;
  rating_schedule?: number;
  rating_stay?: number;
  rating_guide?: number;
  rating_food?: number;
};

/** 마이페이지: 작성 가능한 후기 카드용 */
export type MyPageWritableReviewItem = {
  eligibility_id: string;
  booking_id: string;
  customer_profile_id: string;
  product_id: string | null;
  product_title: string | null;
  departure_date: string | null;
  return_date: string | null;
  review_open_at: string;
  /** 이미 제출된 리뷰가 있는지 여부 (있으면 writable에서 제외) */
  has_submitted_review?: boolean;
};

/** 마이페이지: 작성 중인 후기 카드용 (draft 지원 시) */
export type MyPageDraftReviewItem = {
  review_id: string;
  eligibility_id?: string;
  title: string | null;
  updated_at?: string;
  created_at?: string;
};

/** 마이페이지: 작성 완료 후기 카드용 */
export type MyPageSubmittedReviewItem = {
  id: string;
  title: string;
  content: string;
  created_at?: string;
  rating?: number;
  image_urls?: string[];
};
