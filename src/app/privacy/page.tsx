import Link from "next/link";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { getLegalDocuments } from "@/lib/legalDocuments";

export default async function PrivacyPage() {
  const documents = await getLegalDocuments();
  return (
    <div className="min-h-screen page-bg-wash text-[var(--text-primary)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[var(--primary)] p-8 text-[var(--on-primary)] shadow-xl">
          <h1 className="text-3xl font-bold md:text-4xl">개인정보 수집 및 이용 동의</h1>
          <p className="mt-2 text-sm text-[var(--on-primary)]/80">회원가입 전 내용을 반드시 확인해 주세요.</p>
        </section>
        <section className="rounded-2xl border border-[var(--primary-soft)] bg-[var(--primary-soft)] p-5 text-sm text-[var(--text-primary)]">
          <p className="font-semibold text-[var(--primary)]">개인정보 주체 권리</p>
          <p className="mt-1 leading-relaxed">
            열람·정정·삭제 등 요청은{" "}
            <Link href="/support/data-request" className="font-semibold underline underline-offset-2">
              개인정보 요청 안내
            </Link>
            페이지를 참고해 주세요.
          </p>
        </section>
        <section className="rounded-3xl bg-[var(--surface)] p-8 shadow-[var(--shadow-soft-strong)] ring-1 ring-[var(--primary-soft)]">
          <div className="whitespace-pre-line text-sm leading-7 text-slate-700">{documents.privacy}</div>
        </section>
      </main>
    </div>
  );
}
