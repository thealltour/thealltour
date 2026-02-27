import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getNoticeById } from "@/lib/notices";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";

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
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="support" />
      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-4xl">
        <PageHero kicker="NOTICE BOARD" title={notice.title} subtitle={undefined} />
        <ContentCard>
          <p className="type-caption text-content-muted">작성일 {formatDate(notice.created_at)}</p>
          <hr className="my-5 border-slate-200" />
          <p className="whitespace-pre-line type-small leading-7 text-content-secondary md:type-body">
            {notice.content}
          </p>
          <div className="mt-[var(--space-5)]">
            <Link
              href="/support"
              className="type-btn inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-content-secondary transition hover:bg-slate-50"
            >
              ← 고객센터로
            </Link>
          </div>
        </ContentCard>
      </SectionBody>
    </div>
  );
}
