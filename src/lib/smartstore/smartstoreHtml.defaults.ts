/** 스마트스토어 HTML 섹션 제목 */
export const SMARTSTORE_SECTION_TITLES = {
  summary: "기본 정보",
  included: "포함 사항",
  excluded: "불포함 사항",
  optional: "선택 관광",
  schedule: "일정 안내",
  bookingConditions: "예약 조건",
  bookingNotes: "예약 시 유의사항",
  travelNotes: "여행 시 유의사항",
  refund: "환불·취소 규정",
  consult: "상담 안내",
} as const;

/** 하단 고정: 여행 시 유의사항 (1문장·문구 수정 시 이 상수만 변경) */
export const SMARTSTORE_NOTICE_TRAVEL =
  "여행 준비물 및 현지 진행 관련 유의사항은 스토어 문의를 통해 확인해 주세요.";

/** 하단 고정: 환불·취소 규정 (1문장) */
export const SMARTSTORE_NOTICE_REFUND =
  "환불 및 취소 관련 세부 기준은 주문 전 스토어 문의를 통해 확인해 주세요.";

/** 하단 고정: 상담 안내 (1문장) */
export const SMARTSTORE_NOTICE_INQUIRY =
  "상품 관련 세부 내용은 스토어 문의를 통해 확인해 주세요.";

/** 구 import 호환: 내용은 각각 SMARTSTORE_NOTICE_TRAVEL / SMARTSTORE_NOTICE_REFUND와 동일 */
export const SMARTSTORE_DEFAULT_TRAVEL_NOTES = SMARTSTORE_NOTICE_TRAVEL;
export const SMARTSTORE_DEFAULT_REFUND = SMARTSTORE_NOTICE_REFUND;

export const SMARTSTORE_DEFAULT_BOOKING_CONDITIONS =
  "최종 일정·가격은 주문·문의 후 확정될 수 있습니다. 예약 절차는 스마트스토어 문의를 이용해 주세요.";
