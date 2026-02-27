import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import { getPublicNotices } from "@/lib/notices";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

export default async function SupportPage() {
  const notices = await getPublicNotices();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="support" />

      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-4xl">
        <PageHero
          kicker="THEALL TOUR SUPPORT"
          title="고객센터"
          subtitle="운영시간, 대표번호, 이메일 및 공지사항을 한 곳에서 확인하실 수 있습니다."
        />

        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10">
          <div className="mb-5 space-y-2">
            <p className="section-label text-[#B8962E]">NOTICE BOARD</p>
            <h2 className="section-title type-h2">공지사항</h2>
          </div>
          {notices.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 type-small text-content-muted">
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
                    <p className="line-clamp-1 type-small font-semibold text-content-primary md:type-body">
                      {notice.title}
                    </p>
                    <span className="shrink-0 type-caption text-content-muted">{formatDate(notice.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </SectionBody>
    </div>
  );
}
