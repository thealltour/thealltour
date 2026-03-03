/**
 * 포인트·경품 교환(승인형) 타입
 * - PointBalance = members.points (확정 보유 포인트)
 * - 결제/PG 없이 운영, 경품 교환은 관리자 승인 후 차감
 */

export type PointLedgerKind = "accrual" | "deduction" | "expiration" | "adjustment";

export type PointLedgerRow = {
  id: string;
  member_id: string;
  kind: PointLedgerKind;
  amount: number; // 양수=적립/증가, 음수=차감/소멸
  balance_after: number | null;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  created_by: string | null;
};

export type PendingPointStatus = "pending" | "approved" | "rejected";

export type PendingPointRow = {
  id: string;
  member_id: string;
  amount: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  status: PendingPointStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  ledger_id: string | null;
};

export type RewardCatalogRow = {
  id: string;
  title: string;
  description: string | null;
  point_price: number;
  image_url: string | null;
  stock_count: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RewardRedemptionStatus = "requested" | "approved" | "rejected" | "shipped";

export type RewardRedemptionRow = {
  id: string;
  member_id: string;
  reward_catalog_id: string;
  point_amount: number;
  status: RewardRedemptionStatus;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_note: string | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
  ledger_id: string | null;
};

/** 회원 마이페이지 포인트 요약 */
export type MemberPointSummary = {
  pointBalance: number; // 확정 보유 (members.points)
  pendingTotal: number; // 미확정 합계
  ledgerRecent: PointLedgerRow[];
  pendingItems: PendingPointRow[];
};

/** 경품 교환 신청 입력 */
export type RewardRedemptionRequestInput = {
  reward_catalog_id: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_note?: string;
};
