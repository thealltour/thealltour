import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import { getPublicNotices } from "@/lib/notices";

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

export default async function SupportPage() {
  const notices = await getPublicNotices();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="support" />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-white p-10 shadow-md ring-1 ring-[#dbeafe]">
          <p className="mb-2 text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR SUPPORT</p>
          <h1 className="text-3xl font-bold">고객센터</h1>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600 md:text-base">
            <p>운영시간: 평일 09:00 - 18:00</p>
            <p>대표번호: 02-0000-0000</p>
            <p>이메일: thealltour@gmail.com</p>
            <p>빠른 문의는 견적문의 페이지를 이용해 주세요.</p>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10">
          <div className="mb-5 space-y-2">
            <p className="text-sm font-semibold tracking-wide text-[#2563eb]">NOTICE BOARD</p>
            <h2 className="text-2xl font-bold md:text-3xl">공지사항</h2>
          </div>
          {notices.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              등록된 공지사항이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => (
                <Link
                  key={notice.id}
                  href={`/support/notices/${notice.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="line-clamp-1 text-sm font-semibold text-slate-800 md:text-base">
                      {notice.title}
                    </p>
                    <span className="shrink-0 text-xs text-slate-500">{formatDate(notice.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
