import type { AuthProviderId, MemberRowForAuth } from "@/lib/auth/types";

/** 카카오 OAuth 동의 화면에 서비스 약관이 포함되므로 사이트 complete-profile 약관 게이트를 면제한다. */
export function shouldWaiveKakaoSiteTerms(provider: AuthProviderId): boolean {
  return provider === "kakao";
}

/** 약관·전화 미비 시 complete-profile 필요 (카카오 전화 수신 시 전화 단계 생략) */
export function memberNeedsProfileCompletion(member: MemberRowForAuth): boolean {
  if (member.profile_completed_at) return false;
  const hasTerms = member.agree_terms && member.agree_privacy;
  const hasPhone = Boolean(member.phone?.trim());
  return !hasTerms || !hasPhone;
}
