import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="about" />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[#1d4ed8] p-10 text-white shadow-xl">
          <p className="mb-3 text-sm font-semibold tracking-wide text-blue-100">ABOUT THEALL TOUR</p>
          <h1 className="text-3xl font-bold md:text-4xl">여행을 디자인해 드립니다</h1>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10">
          <div className="space-y-6 text-slate-700">
            <p className="leading-8">
              당신 만의 특별한 여정이 되어야 할 여행, 똑같은 패키지 여행에 지치셨나요?
              더올투어는 정형화된 일정이 아닌, 고객 한 분 한 분의 취향과 목적에 맞춘
              &apos;큐레이팅 여행&apos;을 지향합니다.
            </p>
            <p className="leading-8">
              수년간 쌓아온 노하우와 탄탄한 현지 네트워크를 바탕으로, 남들은 모르는 숨은 명소부터
              프라이빗한 숙소까지 세밀하게 설계해 드립니다. 전문가의 시선으로 고른 고품격 여행,
              이제 더올투어와 함께 시작하세요.
            </p>
          </div>
          <div className="mt-8">
            <Link
              href="/#contact"
              className="inline-flex rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              맞춤 여행 상담 받기
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
