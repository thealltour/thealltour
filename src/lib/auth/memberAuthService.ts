import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncMemberCustomerProfiles } from "@/lib/customerAccountLinks";
import { createNewMemberNotification } from "@/lib/adminNotifications";
import { generateUniqueUsername } from "@/lib/auth/username";
import { grantKakaoSignupWelcomePoints } from "@/lib/auth/grantKakaoSignupWelcomePoints";
import { memberNeedsProfileCompletion } from "@/lib/auth/memberProfileGate";
import { isKakaoSyncFunnelAcquisition } from "@/lib/analytics/kakaoSyncLandingHit";
import { resolveOAuthIdentityMatchMode } from "@/lib/auth/oauthIdentityMatch";
import type { MemberAcquisition } from "@/lib/auth/memberAcquisition";
import type {
  AuthMode,
  AuthProviderId,
  MemberRowForAuth,
  OAuthCallbackResult,
  OAuthProfile,
} from "@/lib/auth/types";

export { memberNeedsProfileCompletion } from "@/lib/auth/memberProfileGate";

const MEMBER_SELECT =
  "id,username,name,email,phone,password_hash,password_salt,agree_terms,agree_privacy,signup_method,profile_completed_at,kakao_channel_added";

const PENDING_LINK_TTL_MS = 30 * 60 * 1000;

async function isUsernameTaken(username: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("members").select("id").eq("username", username).maybeSingle();
  return Boolean(data);
}

async function findMemberByEmail(email: string | null): Promise<MemberRowForAuth | null> {
  if (!email?.trim()) return null;
  const { data } = await supabaseAdmin
    .from("members")
    .select(MEMBER_SELECT)
    .ilike("email", email.trim())
    .maybeSingle();
  return (data as MemberRowForAuth | null) ?? null;
}

/**
 * 전화번호 기준 기존 회원 조회 (email 매칭 실패 시 폴백).
 * 카카오 동의항목에서 email이 빠져도 phone_number는 필수 동의라 신뢰할 수 있는 보조 식별자.
 * members.phone은 unique 제약이 없으므로, 정확히 1명만 일치할 때만 매칭한다 (모호하면 신규 가입으로 처리).
 */
async function findMemberByPhone(phone: string | null): Promise<MemberRowForAuth | null> {
  const normalized = phone?.replace(/\D/g, "").trim();
  if (!normalized) return null;
  const { data } = await supabaseAdmin.from("members").select(MEMBER_SELECT).eq("phone", normalized).limit(2);
  if (!data || data.length !== 1) return null;
  return data[0] as MemberRowForAuth;
}

/** 계정 연결 화면에 노출할 전화번호 마스킹 (예: 010-****-5678) */
function maskPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

async function findProviderLink(provider: AuthProviderId, providerUserId: string) {
  const { data } = await supabaseAdmin
    .from("member_auth_providers")
    .select("id,member_id,provider,provider_user_id")
    .eq("provider", provider)
    .eq("provider_user_id", providerUserId)
    .maybeSingle();
  return data;
}

async function getMemberById(memberId: string): Promise<MemberRowForAuth | null> {
  const { data } = await supabaseAdmin.from("members").select(MEMBER_SELECT).eq("id", memberId).maybeSingle();
  return (data as MemberRowForAuth | null) ?? null;
}

async function upsertProviderLink(
  memberId: string,
  provider: AuthProviderId,
  profile: OAuthProfile,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("member_auth_providers").upsert(
    {
      member_id: memberId,
      provider,
      provider_user_id: profile.providerUserId,
      email: profile.email,
      display_name: profile.nickname ?? profile.name,
      avatar_url: profile.avatarUrl,
      raw_profile: profile.raw,
      last_login_at: now,
    },
    { onConflict: "provider,provider_user_id" },
  );
  if (error) throw new Error(error.message);
}

/** 카카오 동의항목으로 받은 값이 비어 있는 members 필드를 채움 */
async function applyOAuthProfileToMember(memberId: string, profile: OAuthProfile): Promise<void> {
  const existing = await getMemberById(memberId);
  if (!existing) return;

  const updates: Record<string, unknown> = {};
  if (profile.email?.trim() && !existing.email?.trim()) {
    const conflict = await findMemberByEmail(profile.email);
    if (!conflict) updates.email = profile.email.trim();
  }
  if (profile.name?.trim() && (!existing.name?.trim() || existing.name === "회원")) {
    updates.name = profile.name.trim();
  }
  if (profile.phone?.trim() && !existing.phone?.trim()) {
    updates.phone = profile.phone.trim();
  }
  if (typeof profile.kakaoChannelAdded === "boolean") {
    updates.kakao_channel_added = profile.kakaoChannelAdded;
  }

  if (Object.keys(updates).length === 0) return;
  const { error } = await supabaseAdmin.from("members").update(updates).eq("id", memberId);
  if (error) throw new Error(error.message);
}

async function resolveInsertableEmail(
  email: string | null | undefined,
  fromKakaoSync: boolean,
): Promise<string | null> {
  const trimmed = email?.trim() || null;
  if (!trimmed) return null;
  if (!fromKakaoSync) return trimmed;
  /** members_email_unique_idx — 싱크는 email로 기존 계정과 묶지 않으므로 충돌 시 null */
  const existing = await findMemberByEmail(trimmed);
  return existing ? null : trimmed;
}

async function createSocialMember(
  provider: AuthProviderId,
  profile: OAuthProfile,
  acquisition?: MemberAcquisition | null,
): Promise<MemberRowForAuth> {
  const username = await generateUniqueUsername(provider, profile.providerUserId, isUsernameTaken);
  const fromKakaoSync = isKakaoSyncFunnelAcquisition(acquisition ?? null);
  const email = await resolveInsertableEmail(profile.email, fromKakaoSync);
  const { data, error } = await supabaseAdmin
    .from("members")
    .insert({
      username,
      name: profile.name,
      email,
      phone: profile.phone,
      birth_date: null,
      gender: null,
      password_hash: null,
      password_salt: null,
      /** 카카오싱크 동의 화면에 서비스 약관이 포함되므로 complete-profile 전면 스킵 */
      agree_terms: fromKakaoSync,
      agree_privacy: fromKakaoSync,
      agree_email: false,
      signup_method: "social",
      profile_completed_at: fromKakaoSync ? new Date().toISOString() : null,
      kakao_channel_added: typeof profile.kakaoChannelAdded === "boolean" ? profile.kakaoChannelAdded : null,
      acquisition: acquisition ?? null,
    })
    .select(MEMBER_SELECT)
    .single();

  if (error || !data) throw new Error(error?.message ?? "회원 생성 실패");

  await createNewMemberNotification({
    memberId: String(data.id),
    username: String(data.username),
    name: String(data.name),
  }).catch((err) => console.error("[memberAuthService] createNewMemberNotification failed", err));

  return data as MemberRowForAuth;
}

/**
 * 카카오싱크 유입은 싱크 동의로 약관을 갈음하고 complete-profile을 전면 스킵한다.
 * (전화번호 유무와 무관)
 */
async function applyKakaoSyncTermsAgreementIfNeeded(
  member: MemberRowForAuth,
  acquisition?: MemberAcquisition | null,
): Promise<MemberRowForAuth> {
  if (!isKakaoSyncFunnelAcquisition(acquisition ?? null)) return member;
  const hasTerms = member.agree_terms && member.agree_privacy;
  if (hasTerms && member.profile_completed_at) return member;

  const updates: Record<string, unknown> = {};
  if (!hasTerms) {
    updates.agree_terms = true;
    updates.agree_privacy = true;
  }
  if (!member.profile_completed_at) {
    updates.profile_completed_at = new Date().toISOString();
  }
  if (Object.keys(updates).length === 0) return member;

  const { error } = await supabaseAdmin.from("members").update(updates).eq("id", member.id);
  if (error) {
    console.error("[memberAuthService] applyKakaoSyncTermsAgreementIfNeeded:", error.message);
    return member;
  }
  return (await getMemberById(String(member.id))) ?? member;
}

async function createPendingLink(
  provider: AuthProviderId,
  profile: OAuthProfile,
  existingMemberId: string,
): Promise<string> {
  const expiresAt = new Date(Date.now() + PENDING_LINK_TTL_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("member_auth_pending_links")
    .insert({
      provider,
      provider_user_id: profile.providerUserId,
      provider_email: profile.email,
      provider_profile: profile,
      existing_member_id: existingMemberId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "pending link 생성 실패");
  return String(data.id);
}

export async function syncMemberAfterAuth(member: MemberRowForAuth): Promise<void> {
  await syncMemberCustomerProfiles({
    memberId: String(member.id),
    phone: String(member.phone ?? ""),
    email: String(member.email ?? ""),
    linked_by: "self",
  }).catch((err) => console.error("[memberAuthService] syncMemberCustomerProfiles failed", err));
}

export async function handleOAuthCallback(params: {
  provider: AuthProviderId;
  profile: OAuthProfile;
  mode: AuthMode;
  linkMemberId?: string;
  next: string;
  acquisition?: MemberAcquisition | null;
}): Promise<OAuthCallbackResult> {
  const { provider, profile, mode, linkMemberId, next, acquisition } = params;

  const existingLink = await findProviderLink(provider, profile.providerUserId);
  if (existingLink) {
    const memberId = String(existingLink.member_id);
    await upsertProviderLink(memberId, provider, profile);
    await applyOAuthProfileToMember(memberId, profile);
    let member = await getMemberById(memberId);
    if (!member) throw new Error("연결된 회원을 찾을 수 없습니다.");
    member = await applyKakaoSyncTermsAgreementIfNeeded(member, acquisition);
    await syncMemberAfterAuth(member);
    return {
      type: "session",
      member,
      next,
      needsProfile: memberNeedsProfileCompletion(member),
      isNewMember: false,
    };
  }

  if (mode === "link") {
    if (!linkMemberId) throw new Error("연결할 회원 세션이 필요합니다.");
    const targetMember = await getMemberById(linkMemberId);
    if (!targetMember) throw new Error("회원을 찾을 수 없습니다.");

    const otherLink = await supabaseAdmin
      .from("member_auth_providers")
      .select("id")
      .eq("member_id", linkMemberId)
      .eq("provider", provider)
      .maybeSingle();
    if (otherLink.data) throw new Error("이미 연결된 소셜 계정입니다.");

    await upsertProviderLink(linkMemberId, provider, profile);
    await applyOAuthProfileToMember(linkMemberId, profile);
    const signupMethod =
      targetMember.password_hash && targetMember.signup_method === "social"
        ? "mixed"
        : targetMember.password_hash
          ? "mixed"
          : targetMember.signup_method === "local"
            ? "mixed"
            : "social";
    await supabaseAdmin.from("members").update({ signup_method: signupMethod }).eq("id", linkMemberId);

    let member = (await getMemberById(linkMemberId))!;
    member = await applyKakaoSyncTermsAgreementIfNeeded(member, acquisition);
    await syncMemberAfterAuth(member);
    return {
      type: "session",
      member,
      next,
      needsProfile: memberNeedsProfileCompletion(member),
      isNewMember: false,
    };
  }

  const matchMode = resolveOAuthIdentityMatchMode(acquisition);
  let emailMember: MemberRowForAuth | null = null;
  let phoneMember: MemberRowForAuth | null = null;
  if (matchMode === "phone_only") {
    /** 카카오싱크: 전화만 기존 로컬 계정 연결 기준. 이메일·이름은 신규 취급 */
    phoneMember = await findMemberByPhone(profile.phone);
  } else {
    emailMember = await findMemberByEmail(profile.email);
    /** email이 없거나(동의 미획득) 매칭 실패 시 phone으로 폴백 — 중복 회원 생성 방지 */
    phoneMember = emailMember ? null : await findMemberByPhone(profile.phone);
  }
  const matchedMember = emailMember ?? phoneMember;
  const matchedBy: "email" | "phone" = emailMember ? "email" : "phone";

  if (matchedMember?.password_hash) {
    const pendingId = await createPendingLink(provider, profile, String(matchedMember.id));
    const identifier =
      matchedBy === "email"
        ? profile.email ?? matchedMember.email ?? ""
        : maskPhoneForDisplay(matchedMember.phone ?? profile.phone ?? "");
    return {
      type: "link_account",
      pendingId,
      identifier,
      matchedBy,
      provider,
    };
  }

  if (matchedMember) {
    await upsertProviderLink(String(matchedMember.id), provider, profile);
    await applyOAuthProfileToMember(String(matchedMember.id), profile);
    await supabaseAdmin
      .from("members")
      .update({ signup_method: matchedMember.signup_method === "local" ? "mixed" : "social" })
      .eq("id", matchedMember.id);
    let member = (await getMemberById(String(matchedMember.id)))!;
    member = await applyKakaoSyncTermsAgreementIfNeeded(member, acquisition);
    await syncMemberAfterAuth(member);
    return {
      type: "session",
      member,
      next,
      needsProfile: memberNeedsProfileCompletion(member),
      isNewMember: false,
    };
  }

  let member = await createSocialMember(provider, profile, acquisition);
  await upsertProviderLink(String(member.id), provider, profile);
  member = await applyKakaoSyncTermsAgreementIfNeeded(member, acquisition);
  await syncMemberAfterAuth(member);

  let kakaoWelcomeGranted = false;
  if (provider === "kakao") {
    const welcomeResult = await grantKakaoSignupWelcomePoints(String(member.id)).catch((err) => {
      console.error("[memberAuthService] grantKakaoSignupWelcomePoints failed", err);
      return null;
    });
    kakaoWelcomeGranted = welcomeResult?.granted === true;
  }

  return {
    type: "session",
    member,
    next,
    needsProfile: memberNeedsProfileCompletion(member),
    kakaoWelcomeGranted,
    isNewMember: true,
  };
}

export async function confirmPendingLink(pendingId: string, password: string): Promise<MemberRowForAuth> {
  const { data: pending } = await supabaseAdmin
    .from("member_auth_pending_links")
    .select("*")
    .eq("id", pendingId)
    .maybeSingle();

  if (!pending) throw new Error("연결 요청을 찾을 수 없습니다.");
  if (new Date(String(pending.expires_at)).getTime() < Date.now()) {
    throw new Error("연결 요청이 만료되었습니다.");
  }

  const member = await getMemberById(String(pending.existing_member_id));
  if (!member?.password_hash || !member.password_salt) {
    throw new Error("비밀번호 로그인 계정이 아닙니다.");
  }

  const { verifyPassword } = await import("@/lib/password");
  const ok = verifyPassword(password, member.password_salt, member.password_hash);
  if (!ok) throw new Error("비밀번호가 올바르지 않습니다.");

  const profile = pending.provider_profile as OAuthProfile;
  const provider = pending.provider as AuthProviderId;

  const duplicate = await findProviderLink(provider, profile.providerUserId);
  if (duplicate && String(duplicate.member_id) !== String(member.id)) {
    throw new Error("이 소셜 계정은 이미 다른 회원에 연결되어 있습니다.");
  }

  await upsertProviderLink(String(member.id), provider, profile);
  await applyOAuthProfileToMember(String(member.id), profile);
  await supabaseAdmin.from("members").update({ signup_method: "mixed" }).eq("id", member.id);
  await supabaseAdmin.from("member_auth_pending_links").delete().eq("id", pendingId);

  const updated = (await getMemberById(String(member.id)))!;
  await syncMemberAfterAuth(updated);
  return updated;
}

export async function completeMemberProfile(
  memberId: string,
  input: { phone?: string; agreeTerms: boolean; agreePrivacy: boolean },
): Promise<MemberRowForAuth> {
  const existing = await getMemberById(memberId);
  if (!existing) throw new Error("회원을 찾을 수 없습니다.");

  const phone = input.phone?.replace(/[^\d]/g, "") ?? "";
  const needsPhone = !existing.phone?.trim();
  if (needsPhone && phone.length < 10) {
    throw new Error("전화번호를 정확히 입력해 주세요.");
  }

  const updates: Record<string, unknown> = {
    agree_terms: input.agreeTerms,
    agree_privacy: input.agreePrivacy,
    profile_completed_at: new Date().toISOString(),
  };
  if (phone.length >= 10) updates.phone = phone;

  const { error } = await supabaseAdmin.from("members").update(updates).eq("id", memberId);
  if (error) throw new Error(error.message);

  const member = (await getMemberById(memberId))!;
  await syncMemberAfterAuth(member);
  return member;
}

export async function getMemberAuthProviders(memberId: string) {
  const { data, error } = await supabaseAdmin
    .from("member_auth_providers")
    .select("id,provider,display_name,email,linked_at,last_login_at")
    .eq("member_id", memberId)
    .order("linked_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getMemberAuthSummary(memberId: string) {
  const member = await getMemberById(memberId);
  if (!member) return null;
  const providers = await getMemberAuthProviders(memberId);
  const configured = (await import("@/lib/auth/providerRegistry")).getConfiguredOAuthProviders().map((p) => p.id);
  return {
    hasPassword: Boolean(member.password_hash),
    signupMethod: member.signup_method,
    providers,
    availableProviders: configured.filter(
      (id) => !providers.some((p) => p.provider === id),
    ),
    needsProfileCompletion: memberNeedsProfileCompletion(member),
  };
}

export async function unlinkAuthProvider(memberId: string, provider: AuthProviderId): Promise<void> {
  const member = await getMemberById(memberId);
  if (!member) throw new Error("회원을 찾을 수 없습니다.");

  const { data: providers } = await supabaseAdmin
    .from("member_auth_providers")
    .select("provider")
    .eq("member_id", memberId);

  const count = providers?.length ?? 0;
  const hasPassword = Boolean(member.password_hash);
  if (!hasPassword && count <= 1) {
    throw new Error("다른 로그인 방법을 먼저 등록해 주세요.");
  }

  const { error } = await supabaseAdmin
    .from("member_auth_providers")
    .delete()
    .eq("member_id", memberId)
    .eq("provider", provider);
  if (error) throw new Error(error.message);
}

export async function cleanupExpiredPendingLinks(): Promise<void> {
  await supabaseAdmin
    .from("member_auth_pending_links")
    .delete()
    .lt("expires_at", new Date().toISOString());
}
