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

export default async function ReviewsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const reviews = await getReviews();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="reviews" />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-white p-10 shadow-md ring-1 ring-[#dbeafe]">
          <p className="mb-2 text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR REVIEWS</p>
          <h1 className="text-3xl font-bold">여행후기</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
            실제 고객님들이 남긴 여행 후기를 확인해 보세요. 여행후기 작성은 회원 전용입니다.
          </p>
          <div className="mt-6">
            {session ? (
              <Link
                href="/reviews/write"
                className="inline-flex rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
              >
                여행후기 작성하기
              </Link>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/login?next=/reviews/write"
                  className="inline-flex rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
                >
                  로그인 후 후기 작성
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex rounded-lg border border-[#93c5fd] bg-white px-4 py-2 text-sm font-semibold text-[#1e3a8a] transition hover:bg-[#eff6ff]"
                >
                  회원가입
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-sm text-slate-500 shadow-md ring-1 ring-[#e2e8f0]">
              아직 등록된 여행후기가 없습니다.
            </div>
          ) : (
            reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-[#e2e8f0] md:p-7"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-bold text-[#0f172a]">{review.title}</h2>
                  <span className="text-xs text-slate-500">{formatDate(review.created_at)}</span>
                </div>
                <p className="mb-4 whitespace-pre-line text-sm leading-7 text-slate-700 md:text-base">
                  {review.content}
                </p>
                {review.image_urls && review.image_urls.length > 0 ? (
                  <div className="mb-4 grid grid-cols-2 gap-2 overflow-hidden rounded-xl md:grid-cols-4">
                    {review.image_urls.map((imageUrl, index) => (
                      <div key={`${review.id}-${index}`} className="overflow-hidden rounded-xl ring-1 ring-slate-200">
                        <Image
                          src={imageUrl}
                          alt={`${review.title} 후기 이미지 ${index + 1}`}
                          width={1200}
                          height={800}
                          className="h-36 w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs font-semibold text-[#1d4ed8]">작성자: {review.author_name}</p>
                {session && review.member_id === session.memberId ? (
                  <ReviewItemActions
                    reviewId={review.id}
                    defaultTitle={review.title}
                    defaultContent={review.content}
                    defaultImageUrls={review.image_urls}
                  />
                ) : null}
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
