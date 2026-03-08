/**
 * PR6: 공개 리뷰 상세 페이지.
 * - submitted만 노출, draft/hidden은 getPublicReviewById에서 null 반환 → 404.
 * - PR11: Review JSON-LD, generateMetadata, canonical/og/twitter.
 * - PR12: ReviewDetailImages (lightbox, priority/lazy).
 */
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getPublicReviewById, isVerifiedReview } from "@/lib/reviewStats";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { buildReviewDetailMetadata, buildReviewJsonLd } from "@/lib/seo/reviews";
import ReviewHelpfulButton from "@/components/reviews/ReviewHelpfulButton";
import ReviewDetailReportButton from "@/components/reviews/ReviewDetailReportButton";
import ReviewDetailImages from "@/components/reviews/ReviewDetailImages";
import { SectionBody } from "@/components/layout/SectionBody";

type Props = {
  params: Promise<{ id: string }>;
};

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const review = await getPublicReviewById(id);
  if (!review) {
    return { title: "후기를 찾을 수 없습니다 | 더올투어" };
  }
  const meta = buildReviewDetailMetadata(review, {
    pageUrl: `${getSiteUrl()}/reviews/${id}`,
  });
  if (!meta) return { title: "여행 후기 | 더올투어" };
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    openGraph: meta.openGraph,
    twitter: meta.twitter,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StarDisplay({ rating, label }: { rating?: number; label: string }) {
  if (typeof rating !== "number") return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="text-amber-500">
        {"★".repeat(rating)}
        {"☆".repeat(5 - rating)}
      </span>
    </div>
  );
}

function ContentSection({ id, title, content }: { id?: string; title: string; content?: string }) {
  if (!content) return null;
  return (
    <div className="space-y-2">
      <h2 id={id} className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{content}</p>
    </div>
  );
}

function isGeneratedContent(
  content: string,
  review: { content_good?: string; content_bad?: string; content_tip?: string },
): boolean {
  const parts: string[] = [];
  if (review.content_good) parts.push(`[좋았던 점]\n${review.content_good}`);
  if (review.content_bad) parts.push(`[아쉬웠던 점]\n${review.content_bad}`);
  if (review.content_tip) parts.push(`[여행 팁]\n${review.content_tip}`);
  const generated = parts.join("\n\n");
  return content.trim() === generated.trim();
}

export default async function PublicReviewDetailPage({ params }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const review = await getPublicReviewById(id, { viewerMemberId: session?.memberId });

  if (!review) {
    notFound();
  }

  const images = review.image_urls?.length ? review.image_urls : review.image_url ? [review.image_url] : [];
  const hasStructuredContent = review.content_good || review.content_bad || review.content_tip;
  const hasDetailRatings =
    review.rating_schedule || review.rating_stay || review.rating_guide || review.rating_food;
  const verified = isVerifiedReview(review);
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/reviews/${review.id}`;
  const reviewJsonLd = buildReviewJsonLd(review, { pageUrl });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-slate-900">
      <SiteHeader activeTab="reviews" />

      <SectionBody className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/reviews"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            ← 목록으로
          </Link>
          {review.product_id && (
            <Link
              href={`/products/${review.product_id}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              상품 보기 →
            </Link>
          )}
        </div>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewJsonLd) }}
          />
          <header className="border-b border-slate-200 p-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {verified && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  인증된 여행 후기
                </span>
              )}
              {typeof review.rating === "number" && (
                <span className="text-amber-500">
                  ★ {review.rating}점
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 md:text-2xl">{review.title}</h1>
            {review.summary && (
              <p className="mt-2 text-sm text-slate-600">{review.summary}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
              <div className="flex flex-wrap items-center gap-4">
                <span>작성자: {review.author_name}</span>
                <span>작성일: {formatDate(review.created_at)}</span>
                {review.product_title && (
                  <span>상품: {review.product_title}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <ReviewHelpfulButton
                  reviewId={review.id}
                  helpfulCount={review.helpfulCount}
                  viewerVotedHelpful={review.viewerVotedHelpful}
                />
                <ReviewDetailReportButton
                  reviewId={review.id}
                  viewerReported={review.viewerReported}
                />
              </div>
            </div>
          </header>

          {hasDetailRatings && (
            <section className="border-b border-slate-100 bg-slate-50 px-6 py-4" aria-labelledby="detail-ratings-heading">
              <h2 id="detail-ratings-heading" className="mb-2 text-xs font-medium text-slate-500">세부 평점</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StarDisplay rating={review.rating_schedule} label="일정" />
                <StarDisplay rating={review.rating_stay} label="숙소" />
                <StarDisplay rating={review.rating_guide} label="가이드" />
                <StarDisplay rating={review.rating_food} label="식사" />
              </div>
            </section>
          )}

          {images.length > 0 && (
            <ReviewDetailImages images={images} productTitle={review.product_title} />
          )}

          <div className="p-6">
            {hasStructuredContent ? (
              <div className="space-y-6">
                <section aria-labelledby="content-good-heading">
                  <ContentSection id="content-good-heading" title="좋았던 점" content={review.content_good} />
                </section>
                <section aria-labelledby="content-bad-heading">
                  <ContentSection id="content-bad-heading" title="아쉬웠던 점" content={review.content_bad} />
                </section>
                <section aria-labelledby="content-tip-heading">
                  <ContentSection id="content-tip-heading" title="여행 팁" content={review.content_tip} />
                </section>
                {review.content && !isGeneratedContent(review.content, review) && (
                  <section aria-labelledby="content-extra-heading">
                    <ContentSection id="content-extra-heading" title="추가 내용" content={review.content} />
                  </section>
                )}
              </div>
            ) : (
              <div className="prose prose-slate max-w-none">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {review.content}
                </p>
              </div>
            )}
          </div>
        </article>
      </SectionBody>
    </div>
  );
}
