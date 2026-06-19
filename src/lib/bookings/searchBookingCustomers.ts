import "server-only";

import { findCustomerProfilesByMemberId, linkMemberToCustomerProfile } from "@/lib/customerAccountLinks";
import {
  findCustomerProfileByPhone,
  findOrCreateCustomerProfile,
} from "@/lib/customerProfiles";
import { normalizeInboundSenderPhone, phonesMatchForInquiry } from "@/lib/sms/normalizeInboundPhone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type BookingCustomerSearchItem = {
  key: string;
  customer_profile_id: string | null;
  member_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  kind: "profile" | "member";
  subtitle: string;
  needs_resolve: boolean;
};

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, "\\$&");
}

export async function resolveCustomerProfileForMember(memberId: string) {
  const { data: member, error } = await supabaseAdmin
    .from("members")
    .select("id, name, phone, email")
    .eq("id", memberId)
    .maybeSingle();

  if (error || !member) {
    throw new Error("회원을 찾을 수 없습니다.");
  }

  const linked = await findCustomerProfilesByMemberId(memberId);
  if (linked.length > 0) {
    return {
      customer_profile_id: linked[0].id,
      member_id: memberId,
      name: linked[0].name || String(member.name ?? ""),
      phone: linked[0].phone || String(member.phone ?? ""),
      email: linked[0].email ?? (typeof member.email === "string" ? member.email : null),
    };
  }

  const memberPhone = typeof member.phone === "string" ? member.phone : "";
  const byPhone = memberPhone ? await findCustomerProfileByPhone(memberPhone) : null;
  if (byPhone) {
    await linkMemberToCustomerProfile(memberId, byPhone.id, {
      linked_by: "admin",
      verified_method: "admin_booking",
    });
    return {
      customer_profile_id: byPhone.id,
      member_id: memberId,
      name: byPhone.name || String(member.name ?? ""),
      phone: byPhone.phone || memberPhone,
      email: byPhone.email ?? (typeof member.email === "string" ? member.email : null),
    };
  }

  if (!memberPhone.trim()) {
    throw new Error("회원 연락처가 없어 고객 프로필을 생성할 수 없습니다.");
  }

  const created = await findOrCreateCustomerProfile({
    name: String(member.name ?? "회원"),
    phone: memberPhone,
    email: typeof member.email === "string" ? member.email : undefined,
    source: "admin_booking",
  });

  if (!created) {
    throw new Error("고객 프로필 생성에 실패했습니다.");
  }

  await linkMemberToCustomerProfile(memberId, created.id, {
    linked_by: "admin",
    verified_method: "admin_booking",
  });

  return {
    customer_profile_id: created.id,
    member_id: memberId,
    name: created.name,
    phone: created.phone,
    email: created.email,
  };
}

export async function searchBookingCustomers(q: string, limit = 15): Promise<BookingCustomerSearchItem[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];

  const escaped = escapeIlike(trimmed);
  const normalizedPhone = normalizeInboundSenderPhone(trimmed);

  const [profilesRes, membersRes] = await Promise.all([
    supabaseAdmin
      .from("customer_profiles")
      .select("id, name, phone, email")
      .or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("members")
      .select("id, name, phone, email, username")
      .or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%,username.ilike.%${escaped}%`)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const items = new Map<string, BookingCustomerSearchItem>();

  for (const row of profilesRes.data ?? []) {
    const id = String(row.id ?? "");
    if (!id) continue;
    items.set(`profile:${id}`, {
      key: `profile:${id}`,
      customer_profile_id: id,
      member_id: null,
      name: String(row.name ?? "이름 없음"),
      phone: String(row.phone ?? ""),
      email: typeof row.email === "string" ? row.email : null,
      kind: "profile",
      subtitle: "고객 프로필",
      needs_resolve: false,
    });
  }

  let memberRows = membersRes.data ?? [];
  if (normalizedPhone.length >= 10) {
    const phoneMatches = memberRows.filter((row) =>
      phonesMatchForInquiry(typeof row.phone === "string" ? row.phone : "", normalizedPhone),
    );
    const otherMatches = memberRows.filter(
      (row) => !phonesMatchForInquiry(typeof row.phone === "string" ? row.phone : "", normalizedPhone),
    );
    memberRows = [...phoneMatches, ...otherMatches];
  }

  for (const row of memberRows.slice(0, 20)) {
    const memberId = String(row.id ?? "");
    if (!memberId) continue;

    const memberName = String(row.name ?? row.username ?? "이름 없음");
    const memberPhone = String(row.phone ?? "");
    const memberEmail = typeof row.email === "string" ? row.email : null;

    const linkedProfiles = await findCustomerProfilesByMemberId(memberId);
    if (linkedProfiles.length > 0) {
      for (const profile of linkedProfiles) {
        if (items.has(`profile:${profile.id}`)) {
          const existing = items.get(`profile:${profile.id}`)!;
          if (!existing.member_id) {
            items.set(`profile:${profile.id}`, {
              ...existing,
              member_id: memberId,
              subtitle: "회원 연결 · 고객 프로필",
            });
          }
          continue;
        }
        items.set(`profile:${profile.id}`, {
          key: `profile:${profile.id}`,
          customer_profile_id: profile.id,
          member_id: memberId,
          name: profile.name || memberName,
          phone: profile.phone || memberPhone,
          email: profile.email ?? memberEmail,
          kind: "profile",
          subtitle: "회원 · 연결된 고객 프로필",
          needs_resolve: false,
        });
      }
      continue;
    }

    const byPhone = memberPhone ? await findCustomerProfileByPhone(memberPhone) : null;
    if (byPhone) {
      if (!items.has(`profile:${byPhone.id}`)) {
        items.set(`profile:${byPhone.id}`, {
          key: `profile:${byPhone.id}`,
          customer_profile_id: byPhone.id,
          member_id: memberId,
          name: byPhone.name || memberName,
          phone: byPhone.phone || memberPhone,
          email: byPhone.email ?? memberEmail,
          kind: "profile",
          subtitle: "회원 · 전화번호 일치 프로필",
          needs_resolve: false,
        });
      }
      continue;
    }

    if (!items.has(`member:${memberId}`)) {
      items.set(`member:${memberId}`, {
        key: `member:${memberId}`,
        customer_profile_id: null,
        member_id: memberId,
        name: memberName,
        phone: memberPhone,
        email: memberEmail,
        kind: "member",
        subtitle: "회원 (선택 시 고객 프로필 자동 연결)",
        needs_resolve: true,
      });
    }
  }

  return Array.from(items.values()).slice(0, limit);
}
