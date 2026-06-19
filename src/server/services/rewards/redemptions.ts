import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateRedemptionPolicy } from "@/lib/rewardPolicyValidation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  REWARD_REDEMPTION_REF_TYPE,
  buildMemberPointUpdatePayload,
  fetchMemberPoints,
  getMemberPointBalance,
} from "@/server/services/rewards/memberPoints";

export type CreateRedemptionInput = {
  userId: string;
  catalogId: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress1: string;
  shippingAddress2?: string | null;
  shippingZip?: string | null;
  contactTime?: string;
  userMessage?: string;
};

export type AdminRedemptionActionInput = {
  redemptionId: string;
  adminMemo?: string | null;
  reason?: string | null;
};

export type ShipRedemptionInput = {
  redemptionId: string;
  trackingCarrier?: string | null;
  trackingNumber?: string | null;
  adminMemo?: string | null;
};

async function getRedemptionRow(redemptionId: string) {
  const { data: row, error } = await supabaseAdmin
    .from("reward_redemptions")
    .select("id, user_id, catalog_id, point_amount, status")
    .eq("id", redemptionId)
    .maybeSingle();

  if (error || !row) {
    throw new Error("NOT_FOUND");
  }
  return row as {
    id: string;
    user_id: string;
    catalog_id: string;
    point_amount: number;
    status: string;
  };
}

async function decrementCatalogStock(catalogId: string) {
  const { data: catalog } = await supabaseAdmin
    .from("reward_catalog")
    .select("stock, stock_count")
    .eq("id", catalogId)
    .maybeSingle();

  if (catalog == null) return;

  const c = catalog as { stock?: number | null; stock_count?: number | null };
  const current = c.stock ?? c.stock_count;
  if (current == null) return;
  if (current <= 0) {
    throw new Error("OUT_OF_STOCK");
  }

  const nextStock = current - 1;
  const payload: Record<string, string | number> = { updated_at: new Date().toISOString() };
  if (c.stock != null) payload.stock = nextStock;
  if (c.stock_count != null) payload.stock_count = nextStock;
  await supabaseAdmin.from("reward_catalog").update(payload).eq("id", catalogId);
}

/** 회원 교환 신청 — REQUESTED + RESERVE ledger + balance 차감 */
export async function createRewardRedemption(
  input: CreateRedemptionInput,
  client: SupabaseClient = supabaseAdmin,
): Promise<{ id: string }> {
  const {
    userId,
    catalogId,
    shippingName,
    shippingPhone,
    shippingAddress1,
    shippingAddress2 = null,
    shippingZip = null,
    contactTime,
    userMessage,
  } = input;

  const [memberRes, catalogRes, requestedRes] = await Promise.all([
    client.from("members").select("point_balance, points").eq("id", userId).maybeSingle(),
    client
      .from("reward_catalog")
      .select("id, title, point_cost, point_price, stock, stock_count, is_active")
      .eq("id", catalogId)
      .maybeSingle(),
    client
      .from("reward_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "REQUESTED"),
  ]);

  if (memberRes.error || !memberRes.data) throw new Error("MEMBER_FETCH_FAILED");
  if (catalogRes.error || !catalogRes.data) throw new Error("CATALOG_NOT_FOUND");
  if (requestedRes.error) throw new Error("DUPLICATE_CHECK_FAILED");
  if ((requestedRes.count ?? 0) >= 1) throw new Error("PENDING_REDEMPTION_EXISTS");

  const catalog = catalogRes.data as {
    id: string;
    title: string;
    point_cost?: number;
    point_price?: number;
    stock?: number | null;
    stock_count?: number | null;
    is_active: boolean;
  };

  if (!catalog.is_active) throw new Error("CATALOG_INACTIVE");
  const stock = catalog.stock ?? catalog.stock_count;
  if (stock != null && stock <= 0) throw new Error("OUT_OF_STOCK");

  const pointCost = Number(catalog.point_cost ?? catalog.point_price ?? 0);
  const memberRow = memberRes.data as { point_balance?: number; points?: number };
  const balance = getMemberPointBalance(memberRow);
  if (balance < pointCost) throw new Error("INSUFFICIENT_BALANCE");

  const policy = await validateRedemptionPolicy(userId, pointCost, client);
  if (!policy.ok) throw new Error(policy.message);

  const mergedUserMessage = [userMessage, contactTime ? `연락 가능 시간대: ${contactTime}` : ""]
    .filter(Boolean)
    .join("\n");

  const { data: redemption, error: redemptionErr } = await client
    .from("reward_redemptions")
    .insert({
      user_id: userId,
      catalog_id: catalog.id,
      status: "REQUESTED" as const,
      point_amount: pointCost,
      user_message: mergedUserMessage || null,
      shipping_name: shippingName,
      shipping_phone: shippingPhone,
      shipping_zip: shippingZip,
      shipping_address1: shippingAddress1,
      shipping_address2: shippingAddress2,
    })
    .select("id")
    .maybeSingle();

  if (redemptionErr || !redemption) throw new Error("REDEMPTION_CREATE_FAILED");

  const redemptionId = (redemption as { id: string }).id;
  const { error: ledgerErr } = await client.from("point_ledger").insert({
    user_id: userId,
    type: "RESERVE",
    status: "CONFIRMED",
    amount: pointCost,
    reason: "리워드 교환 신청",
    ref_type: REWARD_REDEMPTION_REF_TYPE,
    ref_id: redemptionId,
  });

  if (ledgerErr) {
    await client.from("reward_redemptions").delete().eq("id", redemptionId);
    throw new Error("LEDGER_RESERVE_FAILED");
  }

  const { error: memberUpdateErr } = await client
    .from("members")
    .update(buildMemberPointUpdatePayload(memberRow, balance - pointCost))
    .eq("id", userId);

  if (memberUpdateErr) {
    await client.from("reward_redemptions").delete().eq("id", redemptionId);
    throw new Error("BALANCE_UPDATE_FAILED");
  }

  await client.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "리워드 교환 신청 접수",
    body: "승인 후 발송이 진행됩니다.",
  });

  return { id: redemptionId };
}

/**
 * 관리자 승인 — 신청 시 이미 balance/RESERVE 처리됨.
 * 재고 감소 + APPROVED 전환만 수행 (이중 차감 없음).
 */
export async function approveRewardRedemption(input: AdminRedemptionActionInput): Promise<void> {
  const row = await getRedemptionRow(input.redemptionId);
  if (row.status !== "REQUESTED") throw new Error("ALREADY_PROCESSED");

  await decrementCatalogStock(row.catalog_id);

  const { error: updateErr } = await supabaseAdmin
    .from("reward_redemptions")
    .update({
      status: "APPROVED",
      decided_at: new Date().toISOString(),
      admin_memo: input.adminMemo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.redemptionId);

  if (updateErr) throw new Error("APPROVE_UPDATE_FAILED");

  await supabaseAdmin.from("notifications").insert({
    user_id: row.user_id,
    type: "REWARD_STATUS",
    title: "교환 승인",
    body: "경품 교환이 승인되었습니다. 발송 예정입니다.",
  });
}

/** 관리자 반려 — RELEASE ledger + balance 복구 */
export async function rejectRewardRedemption(input: AdminRedemptionActionInput): Promise<void> {
  const row = await getRedemptionRow(input.redemptionId);
  if (row.status !== "REQUESTED") throw new Error("ALREADY_PROCESSED");

  const amount = Number(row.point_amount);
  const { error: ledgerErr } = await supabaseAdmin.from("point_ledger").insert({
    user_id: row.user_id,
    type: "RELEASE",
    status: "CONFIRMED",
    amount,
    reason: "경품 교환 반려로 인한 포인트 복구",
    ref_type: REWARD_REDEMPTION_REF_TYPE,
    ref_id: input.redemptionId,
  });

  if (ledgerErr) throw new Error("LEDGER_RELEASE_FAILED");

  const { row: memberRow, balance } = await fetchMemberPoints(supabaseAdmin, row.user_id);
  const { error: updateMemberErr } = await supabaseAdmin
    .from("members")
    .update(buildMemberPointUpdatePayload(memberRow, balance + amount))
    .eq("id", row.user_id);

  if (updateMemberErr) throw new Error("BALANCE_RESTORE_FAILED");

  const { error: updateRedemptionErr } = await supabaseAdmin
    .from("reward_redemptions")
    .update({
      status: "REJECTED",
      decided_at: new Date().toISOString(),
      admin_memo: input.adminMemo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.redemptionId);

  if (updateRedemptionErr) throw new Error("REJECT_UPDATE_FAILED");

  const reasonText = input.reason?.trim() || input.adminMemo?.trim() || "";
  await supabaseAdmin.from("notifications").insert({
    user_id: row.user_id,
    type: "REWARD_STATUS",
    title: "교환 반려",
    body: reasonText ? `경품 교환이 반려되었습니다. 사유: ${reasonText}` : "경품 교환이 반려되었습니다.",
  });
}

export async function shipRewardRedemption(input: ShipRedemptionInput): Promise<void> {
  const { data: row, error } = await supabaseAdmin
    .from("reward_redemptions")
    .select("id, user_id, status")
    .eq("id", input.redemptionId)
    .maybeSingle();

  if (error || !row) throw new Error("NOT_FOUND");
  const r = row as { status: string; user_id: string };
  if (r.status !== "APPROVED" && r.status !== "REQUESTED") throw new Error("INVALID_STATUS");

  const now = new Date().toISOString();
  const { error: updateErr } = await supabaseAdmin
    .from("reward_redemptions")
    .update({
      status: "SHIPPED",
      shipped_at: now,
      tracking_carrier: input.trackingCarrier?.trim() || null,
      tracking_number: input.trackingNumber?.trim() || null,
      admin_memo: input.adminMemo?.trim() || null,
      updated_at: now,
    })
    .eq("id", input.redemptionId);

  if (updateErr) throw new Error("SHIP_UPDATE_FAILED");

  const carrier = input.trackingCarrier?.trim() || "";
  const number = input.trackingNumber?.trim() || "";
  const trackingText = carrier && number ? ` (${carrier}: ${number})` : number ? ` (${number})` : "";
  await supabaseAdmin.from("notifications").insert({
    user_id: r.user_id,
    type: "REWARD_STATUS",
    title: "발송 완료",
    body: `경품이 발송되었습니다.${trackingText}`,
  });
}

export async function completeRewardRedemption(input: AdminRedemptionActionInput): Promise<void> {
  const { data: row, error } = await supabaseAdmin
    .from("reward_redemptions")
    .select("id, status, user_id")
    .eq("id", input.redemptionId)
    .maybeSingle();

  if (error || !row) throw new Error("NOT_FOUND");
  const r = row as { status: string; user_id: string };
  if (r.status !== "SHIPPED" && r.status !== "APPROVED") throw new Error("INVALID_STATUS");

  const now = new Date().toISOString();
  const { error: updateErr } = await supabaseAdmin
    .from("reward_redemptions")
    .update({
      status: "COMPLETED",
      completed_at: now,
      admin_memo: input.adminMemo?.trim() || null,
      updated_at: now,
    })
    .eq("id", input.redemptionId);

  if (updateErr) throw new Error("COMPLETE_UPDATE_FAILED");

  await supabaseAdmin.from("notifications").insert({
    user_id: r.user_id,
    type: "REWARD_STATUS",
    title: "수령 완료",
    body: "경품 수령이 완료 처리되었습니다.",
  });
}

export function mapRedemptionServiceError(error: unknown): { message: string; status: number } {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const map: Record<string, { message: string; status: number }> = {
    NOT_FOUND: { message: "해당 교환 신청을 찾을 수 없습니다.", status: 404 },
    ALREADY_PROCESSED: { message: "이미 처리된 신청입니다.", status: 400 },
    OUT_OF_STOCK: { message: "재고가 없습니다.", status: 400 },
    INVALID_STATUS: { message: "현재 상태에서는 처리할 수 없습니다.", status: 400 },
    CATALOG_NOT_FOUND: { message: "해당 경품을 찾을 수 없습니다.", status: 404 },
    CATALOG_INACTIVE: { message: "현재 교환 불가한 경품입니다.", status: 400 },
    INSUFFICIENT_BALANCE: { message: "보유 포인트가 부족합니다.", status: 400 },
    PENDING_REDEMPTION_EXISTS: { message: "진행 중인 교환 신청이 있어 추가 신청할 수 없습니다.", status: 400 },
    MEMBER_FETCH_FAILED: { message: "회원 정보를 불러올 수 없습니다.", status: 500 },
    DUPLICATE_CHECK_FAILED: { message: "중복 신청 검증에 실패했습니다.", status: 500 },
    REDEMPTION_CREATE_FAILED: { message: "교환 신청 생성에 실패했습니다.", status: 500 },
    LEDGER_RESERVE_FAILED: { message: "포인트 예약 기록에 실패했습니다.", status: 500 },
    BALANCE_UPDATE_FAILED: { message: "포인트 차감 반영에 실패했습니다.", status: 500 },
    APPROVE_UPDATE_FAILED: { message: "승인 처리에 실패했습니다.", status: 500 },
    LEDGER_RELEASE_FAILED: { message: "포인트 복구 기록에 실패했습니다.", status: 500 },
    BALANCE_RESTORE_FAILED: { message: "포인트 복구에 실패했습니다.", status: 500 },
    REJECT_UPDATE_FAILED: { message: "반려 상태 업데이트에 실패했습니다.", status: 500 },
    SHIP_UPDATE_FAILED: { message: "발송 처리에 실패했습니다.", status: 500 },
    COMPLETE_UPDATE_FAILED: { message: "완료 처리에 실패했습니다.", status: 500 },
  };

  if (map[code]) return map[code];
  if (code && !map[code] && error instanceof Error && error.message.length > 0 && error.message.length < 120) {
    return { message: error.message, status: 400 };
  }
  return { message: "처리에 실패했습니다.", status: 500 };
}
