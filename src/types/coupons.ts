/**
 * 쿠폰팩·쿠폰 원장 타입 (골프투어 전용, 포인트 원장과 분리)
 */

export type CouponPackTier = "WELCOME" | "RETURNING";

export type CouponPackStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "REDEEMED"
  | "EXPIRED"
  | "CANCELED";

export type CouponLedgerType =
  | "ISSUE"
  | "RESERVE"
  | "REDEEM"
  | "RELEASE"
  | "EXPIRE"
  | "ADJUST";

export type CouponLedgerStatus = "PENDING" | "CONFIRMED" | "CANCELED";

export type MemberCouponPackRow = {
  id: string;
  user_id: string;
  tier: CouponPackTier;
  unit_amount: number;
  status: CouponPackStatus;
  source_ref_type: string | null;
  source_ref_id: string | null;
  reserved_booking_id: string | null;
  redeemed_booking_id: string | null;
  discount_applied: number | null;
  traveler_count: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CouponLedgerRow = {
  id: string;
  user_id: string;
  pack_id: string | null;
  type: CouponLedgerType;
  status: CouponLedgerStatus;
  amount: number;
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  booking_id: string | null;
  created_at: string;
};
