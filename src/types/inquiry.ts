/** 응대 매뉴얼 패널에서 저장하는 진행 단계 */
export type InquiryResponseStage =
  | "initial_response"
  | "waiting_customer"
  | "checking_availability"
  | "proposal_sent"
  | "follow_up"
  | "closed";

export const INQUIRY_RESPONSE_STAGES: readonly InquiryResponseStage[] = [
  "initial_response",
  "waiting_customer",
  "checking_availability",
  "proposal_sent",
  "follow_up",
  "closed",
] as const;

/** 리드 우선순위 (운영) */
export type InquiryLeadPriority = "high" | "medium" | "low";

export const INQUIRY_LEAD_PRIORITIES: readonly InquiryLeadPriority[] = ["high", "medium", "low"] as const;

/** 활동 로그 유형 */
export type InquiryActivityType =
  | "assigned"
  | "unassigned"
  | "priority_changed"
  | "followup_updated"
  | "response_saved"
  | "consultation_status_changed"
  | "booking_status_changed"
  | "booking_confirmed"
  | "note_updated"
  | "template_copied"
  | "manual_log";

export type InquiryActivityLog = {
  id: string;
  inquiry_id: string;
  activity_type: InquiryActivityType;
  actor_id?: string | null;
  actor_name?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

/** 수신 SMS 매칭 상태 */
export type InboundSmsMatchStatus = "matched" | "unmatched" | "manual_linked";

/** textbee 등 수신 SMS */
export type InquiryInboundSms = {
  id: string;
  provider: string;
  provider_message_id: string;
  sender_phone: string;
  message: string;
  received_at: string;
  inquiry_id?: string | null;
  member_id?: string | null;
  match_status: InboundSmsMatchStatus;
  match_reason?: string | null;
  read_at?: string | null;
  created_at: string;
};

/** SMS 센터 대화 목록 요약 */
export type SmsConversationLinkType = "inquiry" | "member" | "both" | "none";

export type SmsConversationSummary = {
  phone: string;
  lastMessageAt: string;
  lastPreview: string;
  unreadCount: number;
  matchStatus: InboundSmsMatchStatus | "unmatched";
  inquiryId: string | null;
  inquiryName: string | null;
  memberId: string | null;
  memberName: string | null;
  linkType: SmsConversationLinkType;
  hasOutbound: boolean;
};

/** SMS 대화 스레드 항목 (발송 + 수신) */
export type InquirySmsThreadItem =
  | {
      id: string;
      direction: "outbound";
      phone: string;
      message: string;
      at: string;
      send_status: "success" | "failed";
      provider: string;
      actor_name?: string | null;
      failure_reason?: string | null;
    }
  | {
      id: string;
      direction: "inbound";
      phone: string;
      message: string;
      at: string;
      provider: string;
      match_status: InboundSmsMatchStatus;
      read_at?: string | null;
    };

/** SMS(알리고 relay) 발송 로그 */
export type InquiryMessageLog = {
  id: string;
  inquiry_id: string;
  channel: string;
  recipient_phone: string;
  message: string;
  provider: string;
  send_status: "success" | "failed";
  provider_response?: Record<string, unknown> | null;
  failure_reason?: string | null;
  actor_name?: string | null;
  created_at: string;
};

/** 상담 진행 상태 — on_hold: DB 유지·당장 응답 큐에서 제외(보류) */
export type ConsultationStatus = "new" | "contacted" | "closed" | "on_hold";

/** 예약/여행 상태 */
export type BookingStatus = "none" | "reserved" | "completed" | "canceled";

/** 최초 유입 경로 (first touch) 스냅샷 */
export type FirstTouch = {
  firstLandingUrl?: string;
  firstReferrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  firstVisitAt?: string;
};

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
  /** 배정된 회원 id */
  member_id?: string | null;
  /** 상담 진행 상태 */
  consultation_status?: ConsultationStatus;
  /** 예약/완료 상태 */
  booking_status?: BookingStatus;
  /** 상담 완료 시각 */
  completed_at?: string | null;
  created_at?: string;
  /** 상품 옵션 선택 시: 선택 옵션 + 예상 견적 스냅샷 */
  quote_snapshot?: QuoteSnapshot | null;
  /** 최초 유입 경로 (first touch) */
  first_touch?: FirstTouch | null;
  /** 문의 폼 제출 시 페이지 경로 */
  inquiry_page_url?: string | null;
  /** 자동 분류: 유입 채널 (paid | organic | social | referral | direct) */
  acquisition_channel?: string | null;
  /** 자동 분류: 소스 라벨 (google, naver, kakao 등) */
  acquisition_source_label?: string | null;
  /** 자동 분류: 미디엄 */
  acquisition_medium?: string | null;
  /** 자동 분류: 요약 (예: "naver / organic") */
  acquisition_summary?: string | null;
  /** 최초 랜딩 경로 (pathname) */
  first_landing_path?: string | null;
  /** 응대 체크리스트 (DB jsonb) */
  response_checklist?: Record<string, boolean> | null;
  /** 관리자 내부 메모 */
  response_note?: string | null;
  /** 응대 진행 단계 */
  response_stage?: InquiryResponseStage | null;
  /** 응대 도구 필드 마지막 저장 시각 */
  response_updated_at?: string | null;
  /** 담당자 id (선택) */
  assignee_id?: string | null;
  /** 담당자 표시명 */
  assignee_name?: string | null;
  /** 리드 우선순위 */
  lead_priority?: InquiryLeadPriority | null;
  /** 다음 액션 메모 */
  next_action?: string | null;
  /** 팔로업 예정 시각 */
  follow_up_at?: string | null;
  /** 고객 마지막 연락 시각 */
  last_contacted_at?: string | null;
  /** 마지막 운영 활동 시각 */
  last_activity_at?: string | null;
  /** 상세 조회 시에만 포함 가능 */
  activity_logs?: InquiryActivityLog[] | null;
  /** 미확인 수신 SMS 건수 (목록 API에서 주입) */
  unread_inbound_sms_count?: number;
};

/** 출발 희망일 스냅샷 (quote_snapshot.desiredDeparture) */
export type DesiredDepartureSnapshot = {
  date?: string | null;
  flexible?: boolean;
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
  desiredDeparture?: DesiredDepartureSnapshot;
  golf_brief?: Record<string, string>;
  pointsUseRequested?: number;
  pointsBalanceAtSubmit?: number;
};

export type InquiryInput = {
  name: string;
  phone: string;
  content: string;
  product_id?: string;
  product_title?: string;
  source_path?: string;
  /** 랜딩 유입 분석용 (쿼리에서 전달) */
  landing_slug?: string;
  quote_category?: string;
  /** 옵션 선택 시에만 전송 (빈 객체 금지) */
  selected_options?: Record<string, string>;
  /** 예상 금액/breakdown (옵션 선택 시) */
  quote_summary?: {
    total: number | null;
    base_price: number | null;
    breakdown: Array<{ group_label: string; option_label: string; price_delta: number }>;
  };
  inquired_at?: string;
  /** 최초 유입 경로 (first touch) */
  first_touch?: FirstTouch | null;
  /** 문의 폼 제출 시 페이지 경로 */
  inquiry_page_url?: string | null;
  /** 견적/골프 브리프 등 구조화 스냅샷 */
  quote_snapshot?: QuoteSnapshot | null;
  /** 로그인 회원 빠른문의 시 포인트 사용 요청 (원) */
  points_use_requested?: number;
};
