import MyPageLayout from "@/components/mypage/MyPageLayout";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import ConnectedAccountsCard from "@/components/mypage/ConnectedAccountsCard";
import { cookies } from "next/headers";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMemberAuthSummary } from "@/lib/auth/memberAuthService";

export default async function MyPageProfilePage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const memberId = session?.memberId ?? "";

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("id, username, name, email, phone, created_at")
    .eq("id", memberId)
    .maybeSingle();

  const authSummary = memberId ? await getMemberAuthSummary(memberId) : null;

  return (
    <MyPageLayout title="회원정보" description="기본 회원 정보를 확인할 수 있습니다.">
      {authSummary?.needsProfileCompletion ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          리워드 신청·상담 연동을 위해{" "}
          <a href="/auth/complete-profile?next=/mypage/profile" className="font-semibold underline">
            추가 정보 입력
          </a>
          이 필요합니다.
        </div>
      ) : null}

      <MyPageCard>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="type-caption text-[var(--text-muted)]">이름</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">{member?.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="type-caption text-[var(--text-muted)]">아이디</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">{member?.username ?? "-"}</dd>
          </div>
          <div>
            <dt className="type-caption text-[var(--text-muted)]">이메일</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">{member?.email ?? "-"}</dd>
          </div>
          <div>
            <dt className="type-caption text-[var(--text-muted)]">전화번호</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">
              {member?.phone ?? "미등록 (리워드 신청 전 입력 권장)"}
            </dd>
          </div>
          <div>
            <dt className="type-caption text-[var(--text-muted)]">가입일</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">
              {member?.created_at ? new Date(member.created_at).toLocaleDateString("ko-KR") : "-"}
            </dd>
          </div>
        </dl>
      </MyPageCard>

      {authSummary ? (
        <div className="mt-6">
          <ConnectedAccountsCard initialSummary={authSummary} />
        </div>
      ) : null}
    </MyPageLayout>
  );
}
