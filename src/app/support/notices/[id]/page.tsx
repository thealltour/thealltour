import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getNoticeById } from "@/lib/notices";

type NoticeDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

export default async function NoticeDetailPage({ params }: NoticeDetailPageProps) {
  const { id } = await params;
  const notice = await getNoticeById(id);

  if (!notice) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="support" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12 md:px-10">
        <Link
          href="/support"
          className="inline-flex w-fit rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          ← 고객센터로
        </Link>
        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10">
          <p className="text-xs text-slate-500">작성일 {formatDate(notice.created_at)}</p>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">{notice.title}</h1>
          <hr className="my-5 border-slate-200" />
          <p className="whitespace-pre-line text-sm leading-7 text-slate-700 md:text-base">
            {notice.content}
          </p>
        </section>
      </main>
    </div>
  );
}
