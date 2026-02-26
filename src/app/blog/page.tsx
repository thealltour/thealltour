import SiteHeader from "@/components/SiteHeader";
import Image from "next/image";
import Link from "next/link";
import { getPublishedGuides } from "@/lib/guides";

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR");
}

export default async function BlogPage() {
  const guides = await getPublishedGuides();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="blog" />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10">
          <p className="mb-2 text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR GUIDE</p>
          <h1 className="text-3xl font-bold md:text-4xl">여행가이드</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
            지역별 골프장 정보, 시즌별 추천 코스, 출발 전 꼭 알아두면 좋은 팁들을 정리한 가이드입니다.
            카드형 리스트에서 원하는 가이드를 골라 자세한 랜딩 페이지로 이동해 보세요.
          </p>
        </section>

        <section className="space-y-4">
          {guides.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-sm text-slate-500 shadow-md ring-1 ring-[#e2e8f0]">
              아직 등록된 여행가이드가 없습니다. 관리자 페이지에서 가이드를 등록해 주세요.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {guides.map((guide) => {
                const hasLanding = !!guide.landing_url;
                return (
                  <article
                    key={guide.id}
                    className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    {guide.thumbnail_url ? (
                      <div className="relative h-40 w-full overflow-hidden">
                        <Image
                          src={guide.thumbnail_url}
                          alt={guide.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-40 items-center justify-center bg-[#eff6ff] text-xs text-slate-400">
                        썸네일 이미지 없음
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563eb]">
                          TRAVEL GUIDE
                        </p>
                        <h2 className="line-clamp-2 text-base font-bold text-[#0f172a] md:text-lg">
                          {guide.title}
                        </h2>
                      </div>
                      {guide.summary ? (
                        <p className="line-clamp-4 text-sm leading-6 text-slate-700">{guide.summary}</p>
                      ) : null}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                        <div className="flex flex-col text-[11px] text-slate-400">
                          {hasLanding ? <span>랜딩 페이지 연결됨</span> : <span>랜딩 URL 미설정</span>}
                          <span>{formatDate(guide.created_at)}</span>
                        </div>
                        {hasLanding ? (
                          <Link
                            href={guide.landing_url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-full bg-[#1d4ed8] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1e40af]"
                          >
                            자세히 보기
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
