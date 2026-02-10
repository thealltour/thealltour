import InquiryForm from "@/components/InquiryForm";
import SiteHeader from "@/components/SiteHeader";

type QuotePageProps = {
  searchParams?: Promise<{
    product_id?: string;
    product_title?: string;
    source_path?: string;
  }>;
};

export default async function QuotePage({ searchParams }: QuotePageProps) {
  const query = (await searchParams) ?? {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="quote" />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[#1d4ed8] p-10 text-white shadow-xl">
          <p className="mb-3 text-sm font-semibold tracking-wide text-blue-100">THEALL TOUR QUOTE</p>
          <h1 className="text-3xl font-bold md:text-4xl">맞춤 견적 문의</h1>
          <p className="mt-3 text-sm text-blue-100 md:text-base">
            메인페이지의 문의 작성란과 동일한 폼입니다. 여행 희망 조건을 남겨주시면 빠르게 상담드립니다.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10">
          <div className="mb-6 space-y-2">
            <p className="text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR CONTACT</p>
            <h2 className="text-2xl font-bold md:text-3xl">견적 문의 작성</h2>
            <p className="text-sm text-slate-600">
              이름, 연락처, 문의 내용을 남겨주시면 맞춤 견적으로 안내드리겠습니다.
            </p>
          </div>
          <InquiryForm
            source={{
              product_id: query.product_id,
              product_title: query.product_title,
              source_path: query.source_path,
            }}
          />
        </section>
      </main>
    </div>
  );
}
