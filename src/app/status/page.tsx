import Link from "next/link";
import SiteHeader from "@/components/site-chrome/SiteHeader";

export const metadata = {
  title: "서비스 상태",
  description: "더올투어 서비스 상태 및 외부 인프라 상태 페이지 안내",
};

export default function StatusPage() {
  return (
    <div className="min-h-screen page-bg-wash text-[var(--text-primary)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[var(--primary)] p-8 text-[var(--on-primary)] shadow-xl">
          <h1 className="text-3xl font-bold md:text-4xl">서비스 상태</h1>
          <p className="mt-2 text-sm text-blue-100">
            호스팅·데이터베이스 등 외부 서비스 상태는 각 사업자 공식 상태 페이지에서 확인할 수 있습니다.
          </p>
        </section>
        <section className="space-y-4 rounded-3xl bg-white p-8 shadow-md ring-1 ring-[var(--primary-soft)]">
          <p className="text-sm leading-7 text-slate-700">
            더올투어 웹 애플리케이션은 Vercel에 배포되며, 데이터는 Supabase를 사용합니다. 장애 시 아래 링크를
            참고해 주세요.
          </p>
          <ul className="list-inside list-disc space-y-2 text-sm font-medium text-[var(--primary)]">
            <li>
              <a
                href="https://www.vercel-status.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-90"
              >
                Vercel 상태
              </a>
            </li>
            <li>
              <a
                href="https://status.supabase.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-90"
              >
                Supabase 상태
              </a>
            </li>
          </ul>
          <p className="text-sm text-slate-600">
            본 페이지는 자동 헬스 대시보드가 아니라 안내용입니다. 문의는{" "}
            <Link href="/#contact" className="font-semibold text-[var(--primary)] underline underline-offset-2">
              상담
            </Link>
            을 이용해 주세요.
          </p>
        </section>
      </main>
    </div>
  );
}
