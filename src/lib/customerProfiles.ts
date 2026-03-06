/**
 * 비로그인 상담 고객 프로필 조회/생성.
 * 전화번호·이메일 기준 고객 묶음, 중복 생성 방지.
 * 서버 전용: RLS로 anon 직접 접근이 막혀 있으므로 supabaseAdmin(service_role) 사용.
 *
 * 현재 한계 및 후속 보완 포인트(TODO):
 * - 가족 공용 번호: 동일 번호로 여러 고객 문의 시 한 프로필로 묶임. 후속에서 구분 정책 검토.
 * - 이메일 보조 매칭: findOrCreate 시 전화 실패 시 이메일로 조회 추가함. 추가 보강 가능.
 * - 기존 프로필 발견 시 name/email 보정 업데이트 미구현. 후속에서 선택적 업데이트 검토.
 * - 동시 요청 race condition: 동일 번호 동시 요청 시 중복 생성 가능. 트랜잭션 또는 unique + 재시도 검토.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CustomerProfile, CustomerProfileInput } from "@/types/customerProfile";

const SOURCE_DEFAULT = "inquiry";

/** 전화번호 정규화: 숫자만 추출 (최대 11자리) */
export function normalizePhone(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "").slice(0, 11);
  return digits;
}

function toProfile(row: Record<string, unknown>): CustomerProfile {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    email: typeof row.email === "string" ? row.email : null,
    source: String(row.source ?? SOURCE_DEFAULT),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** 전화번호로 고객 프로필 조회 (1건). 없으면 null */
export async function findCustomerProfileByPhone(phone: string): Promise<CustomerProfile | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin
    .from("customer_profiles")
    .select("*")
    .eq("phone", normalized)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toProfile(data as Record<string, unknown>);
}

/** 이메일로 고객 프로필 조회 (1건). 없으면 null. 이메일이 비어 있으면 미조회 */
export async function findCustomerProfileByEmail(email: string): Promise<CustomerProfile | null> {
  const trimmed = (email ?? "").trim().toLowerCase();
  if (!trimmed) return null;

  const { data, error } = await supabaseAdmin
    .from("customer_profiles")
    .select("*")
    .eq("email", trimmed)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toProfile(data as Record<string, unknown>);
}

/** 고객 프로필 생성. 중복 전화번호 시 기존 반환용으로 호출 전 find 로 확인 권장 */
export async function createCustomerProfile(
  input: CustomerProfileInput,
): Promise<CustomerProfile | null> {
  const phone = normalizePhone(input.phone);
  if (!phone) return null;

  const payload = {
    name: input.name.trim(),
    phone,
    email: input.email?.trim() || null,
    source: input.source?.trim() || SOURCE_DEFAULT,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("customer_profiles")
    .insert(payload)
    .select("id,name,phone,email,source,created_at,updated_at")
    .maybeSingle();

  if (error || !data) return null;
  return toProfile(data as Record<string, unknown>);
}

/**
 * 전화번호 기준으로 프로필 조회, 없으면 생성 후 반환.
 * 동일 전화번호로 동시 요청 시 중복 생성 가능성 있으므로, 필요 시 애플리케이션 레벨 락/재시도 고려.
 *
 * TODO(후속 PR): (1) 가족 공용 번호 이슈 — 동일 번호로 여러 고객이 문의 시 한 프로필로 묶임. (2) 이메일 보조 매칭 도입 검토.
 * TODO(후속 PR): 기존 profile 발견 시 name/email 보정 업데이트 가능성. (3) 동시 요청 race condition — 트랜잭션 또는 unique + 재시도 고려.
 */
export async function findOrCreateCustomerProfile(
  input: CustomerProfileInput,
): Promise<CustomerProfile | null> {
  const existing = await findCustomerProfileByPhone(input.phone);
  if (existing) return existing;
  if (input.email?.trim()) {
    const byEmail = await findCustomerProfileByEmail(input.email.trim());
    if (byEmail) return byEmail;
  }
  return createCustomerProfile(input);
}
