import MyPageLayout from "@/components/mypage/MyPageLayout";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import ConnectedAccountsCard from "@/components/mypage/ConnectedAccountsCard";
import { cookies } from "next/headers";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMemberAuthSummary } from "@/lib/auth/memberAuthService";
import { getMyPageMemberSummary } from "@/lib/mypage/memberSummary";

export default async function MyPageProfilePage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const memberId = session?.memberId ?? "";

  const [memberSummary, memberResult, authSummary] = await Promise.all([
    getMyPageMemberSummary(),
    supabaseAdmin
      .from("members")
      .select("id, username, name, email, phone, created_at")
      .eq("id", memberId)
      .maybeSingle(),
    memberId ? getMemberAuthSummary(memberId) : Promise.resolve(null),
  ]);

  const member = memberResult.data;

  return (
    <MyPageLayout
      title="회원정보"
      description="기본 회원 정보를 확인할 수 있습니다."
      memberSummary={memberSummary}
    >
      {authSummary?.needsProfileCompletion ? (
        <div className="mb-4 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]">
          리워드 신청·상담 연동을 위해{" "}
          <a href="/auth/complete-profile?next=/mypage/profile" className="font-semibold underline">
            추가 정보 입력
          </a>
          이 필요합니다.
        </div>
      ) : null}

      <MyPageCard title="기본 정보">
        <dl className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "이름", value: member?.name ?? "-" },
            { label: "아이디", value: member?.username ?? "-" },
            { label: "이메일", value: member?.email ?? "-" },
            {
              label: "전화번호",
              value: member?.phone ?? "미등록 (리워드 신청 전 입력 권장)",
            },
            {
              label: "가입일",
              value: member?.created_at
                ? new Date(member.created_at).toLocaleDateString("ko-KR")
                : "-",
            },
          ].map((field) => (
            <div
              key={field.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 px-4 py-3"
            >
              <dt className="type-caption text-[var(--text-muted)]">{field.label}</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">{field.value}</dd>
            </div>
          ))}
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
