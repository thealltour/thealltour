import SiteHeader from "@/components/SiteHeader";

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="blog" />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-white p-10 shadow-md ring-1 ring-[#dbeafe]">
          <p className="mb-2 text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR BLOG</p>
          <h1 className="text-3xl font-bold">블로그</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
            여행 팁과 추천 코스, 시즌별 여행 정보를 전해드릴 예정입니다. 곧 업데이트됩니다.
          </p>
        </section>
      </main>
    </div>
  );
}
