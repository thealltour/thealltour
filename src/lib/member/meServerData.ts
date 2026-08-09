/**
 * 마이페이지 서버 컴포넌트용 회원 데이터 조회.
 * 프로덕션에서 NEXT_PUBLIC_APP_URL self-fetch(localhost) 실패를 피하기 위해 API 라우트 대신 DB 직접 조회.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PointLedgerRow } from "@/types/pointsRewardsV2";
import {
  listHeldCouponPackNames,
} from "@/lib/points/couponPacks";

const LEDGER_PAGE_SIZE = 50;
const EXPIRING_DAYS = 30;
const REDEMPTION_PAGE_SIZE = 50;

export type MemberPointsData = {
  balance: number;
  pending: number;
  expiringSoon: number;
  ledger: PointLedgerRow[];
};

export type MemberRedemptionItem = {
  id: string;
  catalog_id: string;
  catalog_title: string | null;
  point_amount: number;
  status: string;
  requested_at: string;
  decided_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  admin_memo: string | null;
  user_message: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
  shipping_zip: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  created_at: string;
};

export type RewardCatalogItem = {
  id: string;
  title: string;
  description: string | null;
  point_cost: number;
  stock: number | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
};

export async function getMemberPointsData(memberId: string): Promise<MemberPointsData | null> {
  if (!memberId) return null;

  const [memberRes, ledgerRes, expiringRes] = await Promise.all([
    supabaseAdmin.from("members").select("point_balance, point_pending").eq("id", memberId).maybeSingle(),
    supabaseAdmin
      .from("point_ledger")
      .select("*")
      .eq("user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(LEDGER_PAGE_SIZE),
    supabaseAdmin
      .from("point_ledger")
      .select("amount")
      .eq("user_id", memberId)
      .eq("type", "EARN")
      .eq("status", "CONFIRMED")
      .not("expires_at", "is", null)
      .gte("expires_at", new Date().toISOString())
      .lte("expires_at", new Date(Date.now() + EXPIRING_DAYS * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  if (memberRes.error || !memberRes.data) {
    return null;
  }

  const balance = Number((memberRes.data as { point_balance?: number }).point_balance ?? 0);
  const pending = Number((memberRes.data as { point_pending?: number }).point_pending ?? 0);
  const ledger = (ledgerRes.data ?? []) as PointLedgerRow[];
  const expiringSoon = (expiringRes.data ?? []).reduce(
    (sum, row) => sum + Number((row as { amount: number }).amount),
    0,
  );

  return { balance, pending, expiringSoon, ledger };
}

export type MemberCouponPackSummary = {
  hasWelcomePack: boolean;
  hasReturningPack: boolean;
  heldNames: string[];
  availableCount: number;
};

export async function getMemberCouponPackSummary(
  memberId: string,
): Promise<MemberCouponPackSummary> {
  if (!memberId) {
    return { hasWelcomePack: false, hasReturningPack: false, heldNames: [], availableCount: 0 };
  }

  const { data, error } = await supabaseAdmin
    .from("member_coupon_packs")
    .select("tier, status")
    .eq("user_id", memberId)
    .in("status", ["AVAILABLE", "RESERVED"])
    .limit(50);

  if (error) {
    console.error("[getMemberCouponPackSummary]", error.message);
    return { hasWelcomePack: false, hasReturningPack: false, heldNames: [], availableCount: 0 };
  }

  const rows = data ?? [];
  const hasWelcomePack = rows.some((r) => r.tier === "WELCOME");
  const hasReturningPack = rows.some((r) => r.tier === "RETURNING");
  const availableCount = rows.filter((r) => r.status === "AVAILABLE").length;

  return {
    hasWelcomePack,
    hasReturningPack,
    heldNames: listHeldCouponPackNames({ hasWelcomePack, hasReturningPack }),
    availableCount,
  };
}

export async function getMemberRedemptionList(memberId: string): Promise<MemberRedemptionItem[]> {
  if (!memberId) return [];

  const { data: rows, error } = await supabaseAdmin
    .from("reward_redemptions")
    .select(`
      id,
      catalog_id,
      point_amount,
      status,
      requested_at,
      decided_at,
      shipped_at,
      completed_at,
      admin_memo,
      user_message,
      shipping_name,
      shipping_phone,
      shipping_address1,
      shipping_address2,
      shipping_zip,
      tracking_carrier,
      tracking_number,
      created_at,
      reward_catalog ( title )
    `)
    .eq("user_id", memberId)
    .order("created_at", { ascending: false })
    .limit(REDEMPTION_PAGE_SIZE);

  if (error) return [];

  return (rows ?? []).map((r: Record<string, unknown>) => {
    const catalog = r.reward_catalog as { title?: string } | null;
    return {
      id: String(r.id),
      catalog_id: String(r.catalog_id),
      catalog_title: catalog?.title ?? null,
      point_amount: Number(r.point_amount ?? 0),
      status: String(r.status ?? ""),
      requested_at: String(r.requested_at ?? ""),
      decided_at: typeof r.decided_at === "string" ? r.decided_at : null,
      shipped_at: typeof r.shipped_at === "string" ? r.shipped_at : null,
      completed_at: typeof r.completed_at === "string" ? r.completed_at : null,
      admin_memo: typeof r.admin_memo === "string" ? r.admin_memo : null,
      user_message: typeof r.user_message === "string" ? r.user_message : null,
      shipping_name: typeof r.shipping_name === "string" ? r.shipping_name : null,
      shipping_phone: typeof r.shipping_phone === "string" ? r.shipping_phone : null,
      shipping_address1: typeof r.shipping_address1 === "string" ? r.shipping_address1 : null,
      shipping_address2: typeof r.shipping_address2 === "string" ? r.shipping_address2 : null,
      shipping_zip: typeof r.shipping_zip === "string" ? r.shipping_zip : null,
      tracking_carrier: typeof r.tracking_carrier === "string" ? r.tracking_carrier : null,
      tracking_number: typeof r.tracking_number === "string" ? r.tracking_number : null,
      created_at: String(r.created_at ?? ""),
    };
  });
}

export async function getActiveRewardCatalog(): Promise<RewardCatalogItem[]> {
  const { data, error } = await supabaseAdmin
    .from("reward_catalog")
    .select("id, title, description, point_cost, stock, image_url, is_active, sort_order, created_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as RewardCatalogItem[];
}

export { getMemberAuthSummary, getMemberAuthProviders } from "@/lib/auth/memberAuthService";
