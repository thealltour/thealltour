import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import CompleteProfileForm from "@/components/auth/CompleteProfileForm";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { memberNeedsProfileCompletion } from "@/lib/auth/memberAuthService";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import type { MemberRowForAuth } from "@/lib/auth/types";

type PageProps = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function CompleteProfilePage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) redirect("/login?next=/auth/complete-profile");

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("id,username,name,email,phone,password_hash,password_salt,agree_terms,agree_privacy,signup_method,profile_completed_at")
    .eq("id", session.memberId)
    .maybeSingle();

  if (!member) redirect("/login");

  const memberRow = member as MemberRowForAuth;
  if (!memberNeedsProfileCompletion(memberRow)) {
    const resolved = (await searchParams) ?? {};
    redirect(sanitizeNextPath(resolved.next, "/mypage"));
  }

  const resolved = (await searchParams) ?? {};
  const nextPath = sanitizeNextPath(resolved.next, "/mypage");
  const needsPhone = !memberRow.phone?.trim();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--bg)] text-[var(--text-primary)]">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[var(--card)] p-8 shadow-[var(--shadow-soft-strong)] ring-1 ring-[var(--border)] md:p-10">
          <div className="mb-6 space-y-2">
            <h1 className="text-2xl font-bold">추가 정보 입력</h1>
            <p className="text-sm text-[var(--text-secondary)]">소셜 로그인 가입을 마무리해 주세요.</p>
          </div>
          <CompleteProfileForm nextPath={nextPath} needsPhone={needsPhone} />
        </section>
      </main>
    </div>
  );
}
