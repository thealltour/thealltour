import SiteHeader from "@/components/SiteHeader";
import ReviewWriteForm from "@/components/ReviewWriteForm";

export default function ReviewWritePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="reviews" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10">
          <div className="mb-6 space-y-2">
            <p className="text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR REVIEWS</p>
            <h1 className="text-3xl font-bold">여행후기 작성</h1>
            <p className="text-sm text-slate-600">
              실제 여행 경험을 남겨주시면 더올투어를 찾는 분들께 큰 도움이 됩니다.
            </p>
          </div>
          <ReviewWriteForm />
        </section>
      </main>
    </div>
  );
}
