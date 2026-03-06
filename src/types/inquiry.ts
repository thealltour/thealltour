/** 상담 진행 상태 */
export type ConsultationStatus = "new" | "contacted" | "closed";

/** 예약/여행 상태 */
export type BookingStatus = "none" | "reserved" | "completed" | "canceled";

export type Inquiry = {
  id: string;
  name: string;
  phone: string;
  content: string;
  product_id?: string;
  product_title?: string;
  source_path?: string;
  /** @deprecated 하위호환용. consultation_status / booking_status 사용 */
  is_completed?: boolean;
  /** 연결된 비로그인 고객 프로필 */
  customer_profile_id?: string | null;
  /** 상담 진행 상태 */
  consultation_status?: ConsultationStatus;
  /** 예약/완료 상태 */
  booking_status?: BookingStatus;
  /** 상담 완료 시각 */
  completed_at?: string | null;
  created_at?: string;
  /** 상품 옵션 선택 시: 선택 옵션 + 예상 견적 스냅샷 */
  quote_snapshot?: QuoteSnapshot | null;
};

/** 문의 시 함께 저장한 옵션/견적 스냅샷 (관리자 표시용, 서버 재계산용) */
export type QuoteSnapshot = {
  selectedOptions?: Record<string, string>;
  quoteSummary?: {
    total: number | null;
    basePrice: number | null;
    breakdown: Array<{ groupLabel: string; optionLabel: string; priceDelta: number }>;
  };
  inquiredAt?: string;
};

export type InquiryInput = {
  name: string;
  phone: string;
  content: string;
  product_id?: string;
  product_title?: string;
  source_path?: string;
  /** 옵션 선택 시에만 전송 (빈 객체 금지) */
  selected_options?: Record<string, string>;
  /** 예상 금액/breakdown (옵션 선택 시) */
  quote_summary?: {
    total: number | null;
    base_price: number | null;
    breakdown: Array<{ group_label: string; option_label: string; price_delta: number }>;
  };
  inquired_at?: string;
};
