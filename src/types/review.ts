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

// ========== PR6: 공개 리뷰 노출용 타입 ==========

/** 공개 노출용 리뷰 항목 (submitted만, 목록/카드용) */
export type PublicReviewItem = {
  id: string;
  title: string;
  summary?: string;
  content: string;
  author_name: string;
  created_at?: string;
  rating?: number;
  image_url?: string;
  image_urls: string[];
  /** eligibility_id 있으면 인증 후기 */
  eligibility_id?: string;
  booking_id?: string;
  product_id?: string | null;
  product_title?: string | null;
  status?: ReviewStatus;
  /** 상세 페이지용 확장 필드 */
  content_good?: string;
  content_bad?: string;
  content_tip?: string;
  rating_schedule?: number;
  rating_stay?: number;
  rating_guide?: number;
  rating_food?: number;
  /** PR8: 도움됨 투표 수 */
  helpfulCount?: number;
  /** PR8: 현재 뷰어가 도움됨 투표했는지 */
  viewerVotedHelpful?: boolean;
  /** PR9: 신고 건수 (관리자 등에서 사용) */
  reportCount?: number;
  /** PR9: 현재 뷰어가 이 리뷰를 신고했는지 */
  viewerReported?: boolean;
  /** PR15: 추천 점수 (recommended 정렬 시에만 채워짐, 내부/디버깅용) */
  recommendationScore?: number;
  /** PR15: 점수 계산에 사용된 신호 (선택, 디버깅/운영용) */
  rankingSignals?: {
    helpfulCount?: number;
    verified?: boolean;
    hasImages?: boolean;
    hasStructuredContent?: boolean;
    freshnessBucket?: string;
  };
};

/** 상품별 리뷰 통계 */
export type ProductReviewStats = {
  averageRating: number;
  reviewCount: number;
  verifiedCount: number;
  photoCount: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

/**
 * 상품 리뷰 요약 카드 표시용 (서버에서 내려준 데이터만 사용, client에서 server-only 미사용).
 * lib/reviewSummaries의 ProductReviewSummary와 동일한 필드 구성.
 */
export type ProductReviewSummaryForDisplay = {
  id: string;
  product_id: string;
  review_count: number;
  average_rating: number | null;
  summary_text: string | null;
  positive_points: string[];
  negative_points: string[];
  recommended_for: string[];
  generated_at: string;
  updated_at: string;
  source_review_ids: string[];
  status: "ready" | "stale" | "failed";
};

/** 리뷰 목록 정렬 옵션 */
export type ReviewSortOption =
  | "latest"
  | "rating_high"
  | "rating_low"
  | "verified_first"
  | "recommended";

/** 리뷰 목록 필터 옵션 */
export type ReviewFilterOption = {
  onlyVerified?: boolean;
  onlyWithImages?: boolean;
  minRating?: 1 | 2 | 3 | 4 | 5;
  productId?: string;
};

// ========== PR7: 후기 작성 폼 UX ==========

/** 작성 진행률 계산용 (0~100) */
export type ReviewProgressState = {
  hasRating: boolean;
  hasSummary: boolean;
  hasContent: boolean;
  hasImages: boolean;
  percent: number;
};

/** 이미지 항목 (드래그 정렬·미리보기용) */
export type ReviewImageItem = {
  id: string;
  url: string;
  file?: File;
};
