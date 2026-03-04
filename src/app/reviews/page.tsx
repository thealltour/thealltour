import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { getReviews } from "@/lib/reviews";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import ReviewItemActions from "@/components/ReviewItemActions";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

function renderStars(rating?: number) {
  if (!rating || rating <= 0) {
    return <span className="type-caption text-content-muted">별점 없음</span>;
  }
  const safe = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <span className="type-small text-amber-400">
      {"★".repeat(safe).padEnd(5, "☆")}
    </span>
  );
}

export default async function ReviewsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const reviews = await getReviews();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="reviews" />

      <SectionBody className="flex flex-col gap-[var(--space-5)]">
        <PageHero
          kicker="THEALL TOUR REVIEWS"
          title="여행후기"
          subtitle="실제 고객님들이 남긴 여행 후기를 카드형으로 한눈에 확인해 보세요. 여행후기 작성은 회원 전용입니다."
        />

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {session ? (
              <Link
                href="/reviews/write"
                className="type-btn inline-flex rounded-full bg-[#1E3A8A] px-5 py-2.5 text-white transition hover:bg-[#0F172A]"
              >
                여행후기 작성하기
              </Link>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/login?next=/reviews/write"
                  className="type-btn inline-flex rounded-full bg-[#1E3A8A] px-5 py-2.5 text-white transition hover:bg-[#0F172A]"
                >
                  로그인 후 후기 작성
                </Link>
                <Link
                  href="/signup"
                  className="type-btn inline-flex rounded-full border border-[#1E3A8A]/40 bg-white px-5 py-2.5 text-[#1E3A8A] transition hover:bg-[#E9EEF5]"
                >
                  회원가입
                </Link>
              </div>
            )}
            <p className="type-caption text-content-muted">
              등록된 후기 {reviews.length}건
            </p>
          </div>
          {reviews.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 type-small text-content-muted shadow-md ring-1 ring-[#e2e8f0]">
              아직 등록된 여행후기가 없습니다.
            </div>
          ) : (
            <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
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
                    <div className="flex h-40 items-center justify-center bg-[#eff6ff] type-small text-content-muted">
                      이미지 없음
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-card-title line-clamp-2 type-body font-bold text-content-primary md:type-small md:font-semibold">
                        {review.title}
                      </h2>
                      <div className="shrink-0 text-right">
                        {renderStars(review.rating)}
                        <p className="mt-1 type-caption text-content-muted">{formatDate(review.created_at)}</p>
                      </div>
                    </div>
                    <p className="line-clamp-4 whitespace-pre-line type-small leading-6 text-content-secondary">
                      {review.content}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <p className="type-caption font-semibold text-[#1E3A8A]">작성자: {review.author_name}</p>
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
      </SectionBody>
    </div>
  );
}
