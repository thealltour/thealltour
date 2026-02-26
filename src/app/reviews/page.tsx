import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { getReviews } from "@/lib/reviews";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import ReviewItemActions from "@/components/ReviewItemActions";

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

function renderStars(rating?: number) {
  if (!rating || rating <= 0) {
    return <span className="text-[11px] text-slate-400">별점 없음</span>;
  }
  const safe = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <span className="text-sm text-amber-400">
      {"★".repeat(safe).padEnd(5, "☆")}
    </span>
  );
}

export default async function ReviewsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const reviews = await getReviews();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="reviews" />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10">
          <p className="mb-2 text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR REVIEWS</p>
          <h1 className="text-3xl font-bold md:text-4xl">여행후기</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
            실제 고객님들이 남긴 여행 후기를 카드형으로 한눈에 확인해 보세요. 여행후기 작성은 회원 전용입니다.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {session ? (
              <Link
                href="/reviews/write"
                className="inline-flex rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
              >
                여행후기 작성하기
              </Link>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/login?next=/reviews/write"
                  className="inline-flex rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
                >
                  로그인 후 후기 작성
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex rounded-full border border-[#93c5fd] bg-white px-5 py-2.5 text-sm font-semibold text-[#1e3a8a] transition hover:bg-[#eff6ff]"
                >
                  회원가입
                </Link>
              </div>
            )}
            <p className="text-xs text-slate-500">
              등록된 후기 {reviews.length}건
            </p>
          </div>
        </section>

        <section className="space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-sm text-slate-500 shadow-md ring-1 ring-[#e2e8f0]">
              아직 등록된 여행후기가 없습니다.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review) => (
                <article
                  key={review.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-1 hover:shadow-lg"
                >
                  {review.image_urls && review.image_urls.length > 0 ? (
                    <div className="relative h-40 w-full overflow-hidden">
                      <Image
                        src={review.image_urls[0]}
                        alt={`${review.title} 후기 대표 이미지`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-[#eff6ff] text-sm text-slate-400">
                      이미지 없음
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-2 text-base font-bold text-[#0f172a] md:text-lg">
                        {review.title}
                      </h2>
                      <div className="shrink-0 text-right">
                        {renderStars(review.rating)}
                        <p className="mt-1 text-[11px] text-slate-400">{formatDate(review.created_at)}</p>
                      </div>
                    </div>
                    <p className="line-clamp-4 whitespace-pre-line text-sm leading-6 text-slate-700">
                      {review.content}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <p className="text-xs font-semibold text-[#1d4ed8]">작성자: {review.author_name}</p>
                      {session && review.member_id === session.memberId ? (
                        <ReviewItemActions
                          reviewId={review.id}
                          defaultTitle={review.title}
                          defaultContent={review.content}
                          defaultImageUrls={review.image_urls}
                        />
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
