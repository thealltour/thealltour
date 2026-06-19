/**
 * 포인트·경품·알림 스키마 v2 타입 (앱 목표 스키마 기준 주 사용 타입)
 * - point_ledger: user_id, type, status, amount(양수), ref_type, ref_id
 * - reward_redemptions: user_id, catalog_id, status 대문자, shipping_address1, shipping_zip, admin_memo, decided_at
 * - users 역할 = members (member_id / user_id 동일 대상)
 */

// -----------------------------------------------------------------------------
// members 확장 필드
// -----------------------------------------------------------------------------
export type MemberPointsExtension = {
  point_balance: number;
  point_pending: number;
  grade_id: string | null;
  marketing_opt_in: boolean;
};

// -----------------------------------------------------------------------------
// point_ledger
// -----------------------------------------------------------------------------
export type PointLedgerType =
  | "EARN"    // 적립
  | "USE"     // 사용(경품 등)
  | "EXPIRE"  // 소멸
  | "ADJUST"  // 조정
  | "RESERVE" // 예약(미확정)
  | "RELEASE"; // 예약 해제/확정

export type PointLedgerStatus = "PENDING" | "CONFIRMED" | "CANCELED";

export type PointLedgerRow = {
  id: string;
  user_id: string; // members.id
  type: PointLedgerType;
  status: PointLedgerStatus;
  amount: number; // 항상 양수
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  expires_at: string | null;
  created_at: string;
};

// -----------------------------------------------------------------------------
// reward_catalog
// -----------------------------------------------------------------------------
export type RewardCatalogRow = {
  id: string;
  title: string;
  description: string | null;
  point_price: number;
  point_cost: number;
  image_url: string | null;
  stock_count: number;
  stock: number | null; // null = 무제한
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// -----------------------------------------------------------------------------
// reward_redemptions
// -----------------------------------------------------------------------------
export type RewardRedemptionStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELED";

export type RewardRedemptionRow = {
  id: string;
  user_id: string;
  catalog_id: string;
  status: RewardRedemptionStatus;
  point_amount: number;
  requested_at: string;
  decided_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  admin_memo: string | null;
  user_message: string | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2: string | null;
  shipping_zip: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
};

// -----------------------------------------------------------------------------
// notifications
// -----------------------------------------------------------------------------
export type NotificationType = "REWARD_STATUS" | "POINT_EARNED" | "ADMIN_MESSAGE";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

// -----------------------------------------------------------------------------
// API/폼용
// -----------------------------------------------------------------------------
export type RewardRedemptionRequestInput = {
  catalog_id: string;
  user_message?: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2?: string;
  shipping_zip?: string;
};

// -----------------------------------------------------------------------------
// point_earn_requests (인당 정비례 통합 리워드)
// -----------------------------------------------------------------------------
export const POINTS_PER_TRAVELER = 20_000;
export const GIFT_WON_VALUE_PER_TRAVELER = 10_000;
export const MAX_TRAVELER_COUNT = 99;
export const MIN_TRAVELER_COUNT = 1;

export type PointEarnRequestStatus = "REQUESTED" | "APPROVED" | "REJECTED";

export type PointEarnRequestGiftStatus = "PENDING" | "SHIPPED" | "COMPLETED" | "CANCELED";

export type PointEarnRequestRow = {
  id: string;
  user_id: string;
  status: PointEarnRequestStatus;
  booking_ref: string;
  departure_date: string;
  payer_name: string;
  traveler_count: number;
  gift_status: PointEarnRequestGiftStatus;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_zip: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
  memo: string | null;
  contact_phone: string | null;
  admin_memo: string | null;
  reject_reason: string | null;
  requested_at: string;
  decided_at: string | null;
  decided_by_admin_id: string | null;
};

export type PointEarnRequestShippingInput = {
  shipping_name: string;
  shipping_phone: string;
  shipping_zip: string;
  shipping_address1: string;
  shipping_address2?: string;
};
