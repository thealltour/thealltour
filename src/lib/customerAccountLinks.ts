/**
 * customer_profile ↔ member 연결.
 * 비회원 문의 고객과 회원 계정을 phone/email 기준으로 묶고, 리뷰 자격 auto-claim에 사용.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { linkUnmatchedInboundSmsToMember } from "@/lib/sms/linkInboundSmsToMemberByPhone";
import { findCustomerProfileByEmail, findCustomerProfileByPhone, normalizePhone } from "@/lib/customerProfiles";
import { adminClaimEligibilityById } from "@/lib/reviewEligibilities";
import type { CustomerAccountLink } from "@/types/customerAccountLink";
import type { CustomerProfile } from "@/types/customerProfile";

function toLink(row: Record<string, unknown>): CustomerAccountLink {
  return {
    id: String(row.id ?? ""),
    customer_profile_id: String(row.customer_profile_id ?? ""),
    member_id: String(row.member_id ?? ""),
    linked_by: String(row.linked_by ?? "self"),
    verified_method: String(row.verified_method ?? "manual"),
    verified_at: String(row.verified_at ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

export type LinkMemberOptions = {
  linked_by?: string;
  verified_method?: string;
};

/** customer_profile ↔ member 연결 (upsert) */
export async function linkMemberToCustomerProfile(
  memberId: string,
  customerProfileId: string,
  options?: LinkMemberOptions,
): Promise<CustomerAccountLink | null> {
  if (!memberId || !customerProfileId) return null;

  const payload = {
    customer_profile_id: customerProfileId,
    member_id: memberId,
    linked_by: options?.linked_by ?? "self",
    verified_method: options?.verified_method ?? "manual",
    verified_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("customer_account_links")
    .upsert(payload, { onConflict: "customer_profile_id,member_id" })
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return toLink(data as Record<string, unknown>);
}

/** member_id로 연결된 customer_profiles 조회 */
export async function findCustomerProfilesByMemberId(memberId: string): Promise<CustomerProfile[]> {
  if (!memberId) return [];

  const { data, error } = await supabaseAdmin
    .from("customer_account_links")
    .select(`
      customer_profiles (
        id,
        name,
        phone,
        email,
        source,
        created_at,
        updated_at
      )
    `)
    .eq("member_id", memberId);

  if (error || !data) return [];

  const profiles: CustomerProfile[] = [];
  for (const row of data) {
    const raw = row.customer_profiles;
    const cp = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
    if (!cp || typeof cp.id !== "string") continue;
    profiles.push({
      id: cp.id,
      name: String(cp.name ?? ""),
      phone: String(cp.phone ?? ""),
      email: typeof cp.email === "string" ? cp.email : null,
      source: String(cp.source ?? "inquiry"),
      created_at: String(cp.created_at ?? ""),
      updated_at: String(cp.updated_at ?? ""),
    });
  }
  return profiles;
}

/** customer_profile에 연결된 member_id (최초 1건) */
export async function findLinkedMemberIdByCustomerProfileId(
  customerProfileId: string,
): Promise<string | null> {
  if (!customerProfileId) return null;

  const { data, error } = await supabaseAdmin
    .from("customer_account_links")
    .select("member_id")
    .eq("customer_profile_id", customerProfileId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return typeof data.member_id === "string" ? data.member_id : null;
}

/** 문의에 배정된 회원 조회: inquiries.member_id 우선, 없으면 customer_profile 연결 */
export async function resolveMemberIdForInquiry(inquiryId: string): Promise<string | null> {
  const { data: inquiry, error } = await supabaseAdmin
    .from("inquiries")
    .select("member_id, customer_profile_id")
    .eq("id", inquiryId)
    .maybeSingle();

  if (error || !inquiry) return null;

  const directMemberId = inquiry.member_id as string | null;
  if (directMemberId) return String(directMemberId);

  const customerProfileId = inquiry.customer_profile_id as string | null;
  if (!customerProfileId) return null;

  return findLinkedMemberIdByCustomerProfileId(customerProfileId);
}

/** 동일 customer_profile 문의들에 member_id 동기화 (null인 건만) */
export async function syncInquiryMemberIdsForCustomerProfile(
  customerProfileId: string,
  memberId: string,
): Promise<number> {
  if (!customerProfileId || !memberId) return 0;

  const { data, error } = await supabaseAdmin
    .from("inquiries")
    .update({ member_id: memberId })
    .eq("customer_profile_id", customerProfileId)
    .is("member_id", null)
    .select("id");

  if (error) return 0;
  return data?.length ?? 0;
}

export type MemberLinkedInquiry = {
  id: string;
  name: string;
  phone: string;
  product_title: string | null;
  booking_status: string | null;
  customer_profile_id: string | null;
  created_at: string | null;
  link_source: "member_id" | "profile";
};

/** 회원에 연결된 문의 목록 (member_id 또는 customer_profile 연결) */
export async function getLinkedInquiriesForMember(memberId: string): Promise<MemberLinkedInquiry[]> {
  const linkedProfiles = await findCustomerProfilesByMemberId(memberId);
  const profileIds = linkedProfiles.map((p) => p.id);

  const byId = new Map<string, MemberLinkedInquiry>();

  const { data: byMemberId } = await supabaseAdmin
    .from("inquiries")
    .select("id, name, phone, product_title, booking_status, customer_profile_id, created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });

  for (const inq of byMemberId ?? []) {
    const id = String(inq.id ?? "");
    if (!id) continue;
    byId.set(id, {
      id,
      name: String(inq.name ?? ""),
      phone: String(inq.phone ?? ""),
      product_title: typeof inq.product_title === "string" ? inq.product_title : null,
      booking_status: typeof inq.booking_status === "string" ? inq.booking_status : null,
      customer_profile_id: inq.customer_profile_id ? String(inq.customer_profile_id) : null,
      created_at: inq.created_at ? String(inq.created_at) : null,
      link_source: "member_id",
    });
  }

  if (profileIds.length > 0) {
    const { data: byProfile } = await supabaseAdmin
      .from("inquiries")
      .select("id, name, phone, product_title, booking_status, customer_profile_id, created_at, member_id")
      .in("customer_profile_id", profileIds)
      .order("created_at", { ascending: false });

    for (const inq of byProfile ?? []) {
      const id = String(inq.id ?? "");
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        id,
        name: String(inq.name ?? ""),
        phone: String(inq.phone ?? ""),
        product_title: typeof inq.product_title === "string" ? inq.product_title : null,
        booking_status: typeof inq.booking_status === "string" ? inq.booking_status : null,
        customer_profile_id: inq.customer_profile_id ? String(inq.customer_profile_id) : null,
        created_at: inq.created_at ? String(inq.created_at) : null,
        link_source: "profile",
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

/** 회원에 아직 연결되지 않은 문의 검색 */
export async function searchConnectableInquiriesForMember(
  memberId: string,
  memberPhone: string,
  search?: string,
): Promise<MemberLinkedInquiry[]> {
  const linked = await getLinkedInquiriesForMember(memberId);
  const linkedIds = new Set(linked.map((i) => i.id));

  const normalizedPhone = normalizePhone(memberPhone);
  const q = search?.trim() ?? "";

  let query = supabaseAdmin
    .from("inquiries")
    .select("id, name, phone, product_title, booking_status, customer_profile_id, created_at, member_id")
    .order("created_at", { ascending: false })
    .limit(15);

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,product_title.ilike.%${q}%,content.ilike.%${q}%`);
  } else if (normalizedPhone) {
    query = query.eq("phone", normalizedPhone);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .filter((inq) => {
      const id = String(inq.id ?? "");
      if (!id || linkedIds.has(id)) return false;
      const assignedMemberId = inq.member_id as string | null;
      return !assignedMemberId || assignedMemberId === memberId;
    })
    .map((inq) => ({
      id: String(inq.id ?? ""),
      name: String(inq.name ?? ""),
      phone: String(inq.phone ?? ""),
      product_title: typeof inq.product_title === "string" ? inq.product_title : null,
      booking_status: typeof inq.booking_status === "string" ? inq.booking_status : null,
      customer_profile_id: inq.customer_profile_id ? String(inq.customer_profile_id) : null,
      created_at: inq.created_at ? String(inq.created_at) : null,
      link_source: "member_id" as const,
    }));
}

/** 해당 profile의 미claim eligibility를 member에게 claim */
export async function autoClaimEligibilitiesForMember(
  memberId: string,
  customerProfileId: string,
): Promise<number> {
  if (!memberId || !customerProfileId) return 0;

  const { data, error } = await supabaseAdmin
    .from("review_eligibilities")
    .select("id, claimed_by_member_id, status")
    .eq("customer_profile_id", customerProfileId)
    .is("claimed_by_member_id", null)
    .in("status", ["eligible", "claimed"]);

  if (error || !data?.length) return 0;

  let claimed = 0;
  for (const row of data) {
    const id = String(row.id ?? "");
    if (!id) continue;
    const result = await adminClaimEligibilityById(id, memberId);
    if (result.success) claimed += 1;
  }
  return claimed;
}

export type SyncMemberCustomerProfilesInput = {
  memberId: string;
  phone: string;
  email?: string | null;
  linked_by?: string;
};

export type SyncMemberCustomerProfilesResult = {
  linkedProfileIds: string[];
  claimedCount: number;
};

/**
 * 회원가입/로그인 시 phone·email로 customer_profile 연결 + 기존 eligibility auto-claim.
 * idempotent — 여러 번 호출해도 안전.
 */
export async function syncMemberCustomerProfiles(
  input: SyncMemberCustomerProfilesInput,
): Promise<SyncMemberCustomerProfilesResult> {
  const memberId = input.memberId;
  const linkedProfileIds: string[] = [];
  let claimedCount = 0;

  const phoneProfile = await findCustomerProfileByPhone(input.phone);
  if (phoneProfile) {
    const link = await linkMemberToCustomerProfile(memberId, phoneProfile.id, {
      linked_by: input.linked_by ?? "self",
      verified_method: "phone_match",
    });
    if (link) {
      linkedProfileIds.push(phoneProfile.id);
      claimedCount += await autoClaimEligibilitiesForMember(memberId, phoneProfile.id);
      await syncInquiryMemberIdsForCustomerProfile(phoneProfile.id, memberId);
    }
  }

  const email = input.email?.trim().toLowerCase();
  if (email) {
    const emailProfile = await findCustomerProfileByEmail(email);
    if (emailProfile && !linkedProfileIds.includes(emailProfile.id)) {
      const link = await linkMemberToCustomerProfile(memberId, emailProfile.id, {
        linked_by: input.linked_by ?? "self",
        verified_method: "email_match",
      });
      if (link) {
        linkedProfileIds.push(emailProfile.id);
        claimedCount += await autoClaimEligibilitiesForMember(memberId, emailProfile.id);
        await syncInquiryMemberIdsForCustomerProfile(emailProfile.id, memberId);
      }
    }
  }

  if (input.phone?.trim()) {
    await linkUnmatchedInboundSmsToMember({
      memberId,
      phone: input.phone,
      matchReason: "phone_exact_member_on_signup",
    }).catch((err) => console.error("[syncMemberCustomerProfiles] SMS backfill failed", err));
  }

  return { linkedProfileIds, claimedCount };
}

/** phone으로 회원 검색 (관리자 문의 연결용) */
export function normalizeMemberPhone(phone: string): string {
  return normalizePhone(phone);
}

export type LinkInquiryToMemberResult =
  | { success: true; claimedCount: number; customerProfileId: string }
  | { success: false; message: string };

/** 문의를 회원에게 배정: inquiries.member_id + customer_account_links + auto-claim */
export async function linkInquiryToMember(
  inquiryId: string,
  memberId: string,
): Promise<LinkInquiryToMemberResult> {
  const { data: inquiry, error } = await supabaseAdmin
    .from("inquiries")
    .select("id, customer_profile_id")
    .eq("id", inquiryId)
    .maybeSingle();

  if (error || !inquiry) {
    return { success: false, message: "문의를 찾을 수 없습니다." };
  }

  const customerProfileId = inquiry.customer_profile_id as string | null;
  if (!customerProfileId) {
    return { success: false, message: "이 문의에 연결된 고객 프로필이 없습니다." };
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError || !member) {
    return { success: false, message: "회원을 찾을 수 없습니다." };
  }

  const { error: updateError } = await supabaseAdmin
    .from("inquiries")
    .update({ member_id: memberId })
    .eq("id", inquiryId);

  if (updateError) {
    return { success: false, message: "문의 회원 배정에 실패했습니다." };
  }

  await syncInquiryMemberIdsForCustomerProfile(customerProfileId, memberId);

  await linkMemberToCustomerProfile(memberId, customerProfileId, {
    linked_by: "admin",
    verified_method: "admin_manual",
  });

  const claimedCount = await autoClaimEligibilitiesForMember(memberId, customerProfileId);

  return { success: true, claimedCount, customerProfileId };
}

/** 문의 회원 배정 해제 (customer_account_links는 유지) */
export async function unlinkInquiryMember(inquiryId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("inquiries")
    .update({ member_id: null })
    .eq("id", inquiryId);

  return !error;
}
