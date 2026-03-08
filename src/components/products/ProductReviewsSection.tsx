/**
 * PR6: 상품 상세 페이지용 리뷰 섹션.
 * - 평균 평점 / 후기 수 / 인증 후기 수
 * - PR14: 리뷰 요약 카드 (있을 때만)
 * - 최근 리뷰 미리보기 카드 (최대 5개)
 * - "전체 후기 보기" CTA
 */
import Image from "next/image";
import Link from "next/link";
import { getProductReviewStats, getProductReviews } from "@/lib/reviewStats";
import { isVerifiedReview } from "@/lib/reviewStats";
import { addTrustScoresToReviews } from "@/lib/reviewTrustScore";
import { getPersonalizedPublicReviews } from "@/lib/reviewPublicSelectors";
import { getDefaultPersonalizationContext } from "@/lib/reviewPersonalization";
import { getPersonalizedSectionTitle } from "@/lib/reviewPersonalizationLabels";
import type { PublicReviewItem, ProductReviewStats } from "@/types/review";
import ReviewHelpfulButton from "@/components/reviews/ReviewHelpfulButton";
import { ProductReviewSummaryCard } from "@/components/products/ProductReviewSummaryCard";
import { ProductReviewSeoSummary } from "@/components/products/ProductReviewSeoSummary";
import { PersonalizedReviewHighlights } from "@/components/products/PersonalizedReviewHighlights";
import { getProductReviewSummary } from "@/lib/reviewSummaries";
import { buildReviewRenderStrategy } from "@/lib/reviewExperimentRenderers";
import { ExperimentedReviewSectionContent } from "@/components/products/ExperimentedReviewSectionContent";
import type { ReviewExperimentKey, ReviewExperimentVariant } from "@/types/reviewExperiment";

export type ProductReviewsSectionProps = {
  productId: string;
  productTitle: string;
  /** PR23: 개인화 컨텍스트 (query 등에서 주입 가능) */
  personalizationContext?: import("@/types/reviewPersonalization").ReviewPersonalizationContext;
  /** PR26: 실험 variant (있으면 A/B 노출 + 계측) */
  experimentKey?: ReviewExperimentKey;
  variant?: ReviewExperimentVariant;
};

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function Stars({ rating }: { rating?: number }) {
  if (rating == null || rating < 1 || rating > 5) {
    return <span className="text-sm text-slate-400">별점 없음</span>;
  }
  const r = Math.round(rating);
  return (
    <span className="text-amber-500">
      {"★".repeat(r)}
      <span className="text-slate-300">{"☆".repeat(5 - r)}</span>
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
      인증된 여행 후기
    </span>
  );
}

function ReviewCard({ review, isBest }: { review: PublicReviewItem; isBest?: boolean }) {
  const images = review.image_urls?.length ? review.image_urls : review.image_url ? [review.image_url] : [];
  const thumbnails = images.slice(0, 3);
  const bodyText = review.summary?.trim() || review.content?.trim() || "";
  const previewLines = bodyText.split(/\n/).filter(Boolean).slice(0, 3).join(" ").slice(0, 120);
  const verified = isVerifiedReview(review);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {isBest && (
        <div className="bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-800">
          BEST REVIEW
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {verified && <VerifiedBadge />}
          <Stars rating={review.rating} />
          <span className="text-xs text-slate-500">{formatDate(review.created_at)}</span>
        </div>
        <h3 className="font-semibold text-slate-900 line-clamp-2">{review.title}</h3>
        {review.summary && (
          <p className="mt-1 text-sm text-slate-600 line-clamp-1">{review.summary}</p>
        )}
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
          {previewLines}
          {previewLines.length >= 120 ? "…" : ""}
        </p>
        {thumbnails.length > 0 && (
          <div className="mt-3 flex gap-2">
            {thumbnails.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100"
              >
                <Image
                  src={url}
                  alt={review.product_title ? `${review.product_title} 여행 후기 이미지` : "여행 후기 이미지"}
                  fill
                  sizes="64px"
                  className="object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <Link
            href={`/reviews/${review.id}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            자세히 보기 →
          </Link>
          <ReviewHelpfulButton
            reviewId={review.id}
            helpfulCount={review.helpfulCount}
            viewerVotedHelpful={review.viewerVotedHelpful}
          />
        </div>
      </div>
    </article>
  );
}

export async function ProductReviewsSection({
  productId,
  productTitle,
  personalizationContext,
  experimentKey,
  variant,
}: ProductReviewsSectionProps) {
  const [stats, reviews, summary] = await Promise.all([
    getProductReviewStats(productId),
    getProductReviews(productId, { limit: 30, sort: "recommended" }),
    getProductReviewSummary(productId),
  ]);

  if (stats.reviewCount === 0) {
    return (
      <section id="reviews" className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
        <h2 className="text-lg font-bold text-slate-900">여행 후기</h2>
        <p className="mt-1 text-sm text-slate-600">실제 여행자들의 생생한 후기를 확인하세요</p>
        <p className="mt-4 text-sm text-slate-500">아직 등록된 후기가 없습니다.</p>
      </section>
    );
  }

  const context = personalizationContext ?? getDefaultPersonalizationContext();
  const reviewsWithTrust = addTrustScoresToReviews(
    reviews.map((r) => ({ ...r, status: "submitted" as const })),
  );
  const { results: personalizedResults, reviewsById } = getPersonalizedPublicReviews(
    reviewsWithTrust,
    context,
    3,
  );
  const highlightItems = personalizedResults
    .map((r) => {
      const review = reviewsById.get(r.reviewId);
      return review
        ? { review: review as PublicReviewItem, personalizedScore: r.personalizedScore, matchedReasons: r.matchedReasons }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const highlightIds = new Set(highlightItems.map((h) => h.review.id));
  const featured = reviewsWithTrust.filter((r) => !highlightIds.has(r.id));
  const bestReview = featured.find((r) => (r.rating ?? 0) >= 4) ?? featured[0];
  const sectionTitle = getPersonalizedSectionTitle(context, "많이 도움이 된 후기");

  if (experimentKey && variant) {
    const strategy = buildReviewRenderStrategy(variant, reviewsWithTrust, {
      productId,
      reviews: reviewsWithTrust,
      summary: summary ?? null,
      personalizedHighlights: highlightItems.map((h) => h.review),
      reviewsWithTrust,
    });
    const displayReviews = strategy.highlightReviews.length > 0
      ? strategy.highlightReviews
      : featured.slice(0, 5);
    return (
      <ExperimentedReviewSectionContent
        experimentKey={experimentKey}
        variant={variant}
        productId={productId}
        productTitle={productTitle}
        strategy={strategy}
        stats={stats}
        summary={summary}
        displayReviews={displayReviews}
        highlightItems={highlightItems}
        sectionTitle={sectionTitle}
        personalizationContext={context}
        bestReview={bestReview}
      />
    );
  }

  const otherReviews = bestReview
    ? featured.filter((r) => r.id !== bestReview.id).slice(0, 4)
    : featured.slice(0, 5);
  const displayReviews: PublicReviewItem[] =
    highlightItems.length > 0
      ? otherReviews
      : bestReview
        ? [bestReview, ...otherReviews]
        : featured.slice(0, 5);
  const showPersonalizedBlock = highlightItems.length > 0;
  const sectionTitleNonExp = getPersonalizedSectionTitle(context, "많이 도움이 된 후기");
  const avg = stats.averageRating.toFixed(1);

  return (
    <section id="reviews" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">여행 후기</h2>
        <p className="mt-1 text-sm text-slate-600">실제 여행자들의 생생한 후기를 확인하세요</p>
        <ProductReviewSeoSummary
          averageRating={stats.averageRating}
          reviewCount={stats.reviewCount}
          summaryText={summary?.summary_text ?? undefined}
        />
      </div>

      <ProductReviewSummaryCard productId={productId} />

      {showPersonalizedBlock && (
        <PersonalizedReviewHighlights
          reviews={highlightItems}
          title={sectionTitleNonExp}
          context={context}
        />
      )}

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-slate-900">★ {avg}</span>
          <span className="text-sm text-slate-600">/ 5</span>
        </div>
        <span className="text-sm text-slate-600">후기 {stats.reviewCount}개</span>
        {stats.verifiedCount > 0 && (
          <span className="text-sm text-blue-700">인증 후기 {stats.verifiedCount}개</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayReviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            isBest={!showPersonalizedBlock && !!bestReview && review.id === bestReview?.id}
          />
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link
          href={`/reviews?productId=${encodeURIComponent(productId)}`}
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          전체 후기 보기
        </Link>
      </div>
    </section>
  );
}
