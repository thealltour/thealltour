import type { MemberRowForAuth } from "@/lib/auth/types";

/** 약관·전화 미비 시 complete-profile 필요 (카카오 전화 수신 시 전화 단계 생략) */
export function memberNeedsProfileCompletion(member: MemberRowForAuth): boolean {
  if (member.profile_completed_at) return false;
  const hasTerms = member.agree_terms && member.agree_privacy;
  const hasPhone = Boolean(member.phone?.trim());
  return !hasTerms || !hasPhone;
}
