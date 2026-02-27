import SiteHeader from "@/components/SiteHeader";
import MemberLoginForm from "@/components/MemberLoginForm";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawNextPath = resolvedSearchParams.next ?? "/";
  const nextPath = rawNextPath.startsWith("/") ? rawNextPath : "/";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10">
          <div className="mb-6 space-y-2">
            <p className="text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR MEMBERS</p>
            <h1 className="text-2xl font-bold">회원 로그인</h1>
            <p className="text-sm text-slate-600">
              여행후기 작성과 회원 전용 기능 이용을 위해 로그인해 주세요.
            </p>
          </div>
          <MemberLoginForm nextPath={nextPath} />
        </section>
      </main>
    </div>
  );
}
