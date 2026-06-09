import MyPageLayout from "@/components/mypage/MyPageLayout";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { Button } from "@/components/ui/Button";
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
      <MyPageCard>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="type-caption text-[var(--text-muted)]">이름</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">{member?.name ?? "-"}</dd>
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
        <Button type="button" variant="outline" size="md" className="mt-6">
          비밀번호 변경
        </Button>
      </MyPageCard>
    </MyPageLayout>
  );
}
