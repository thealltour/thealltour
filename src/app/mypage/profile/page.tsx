import MyPageLayout from "@/components/mypage/MyPageLayout";
import { cookies } from "next/headers";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabase } from "@/lib/supabase";

export default async function MyPageProfilePage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const { data: member } = await supabase
    .from("members")
    .select("id, username, name, email, phone, created_at")
    .eq("id", session?.memberId ?? "")
    .maybeSingle();

  return (
    <MyPageLayout title="회원정보" description="기본 회원 정보를 확인할 수 있습니다.">
      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
          <div>
            <p className="text-xs text-[var(--text-secondary)]">이름</p>
            <p className="text-sm font-medium text-[var(--text-primary)]">{member?.name ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">이메일</p>
            <p className="text-sm font-medium text-[var(--text-primary)]">{member?.email ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">전화번호</p>
            <p className="text-sm font-medium text-[var(--text-primary)]">{member?.phone ?? "미등록 (리워드 신청 전 입력 권장)"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">가입일</p>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {member?.created_at ? new Date(member.created_at).toLocaleDateString("ko-KR") : "-"}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          비밀번호 변경
        </button>
      </section>
    </MyPageLayout>
  );
}
