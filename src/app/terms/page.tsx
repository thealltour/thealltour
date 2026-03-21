import SiteHeader from "@/components/SiteHeader";
import { getLegalDocuments } from "@/lib/legalDocuments";

export default async function TermsPage() {
  const documents = await getLegalDocuments();
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[var(--primary)] p-8 text-[var(--on-primary)] shadow-xl">
          <h1 className="text-3xl font-bold md:text-4xl">서비스 이용약관</h1>
          <p className="mt-2 text-sm text-blue-100">회원가입 전 약관 내용을 반드시 확인해 주세요.</p>
        </section>
        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[var(--primary-soft)]">
          <div className="whitespace-pre-line text-sm leading-7 text-slate-700">{documents.terms}</div>
        </section>
      </main>
    </div>
  );
}
