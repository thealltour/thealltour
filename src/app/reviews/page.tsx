import SiteHeader from "@/components/site-chrome/SiteHeader";
import Link from "next/link";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { getPublicReviews } from "@/lib/reviewStats";
import type { ReviewSortOption } from "@/types/review";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { buildReviewListMetadata } from "@/lib/seo/reviews";
import { getProductByIdFresh } from "@/lib/products";
import ReviewListFilters from "@/components/reviews/ReviewListFilters";
import { ReviewSearchBar } from "@/components/reviews/ReviewSearchBar";
import PublicReviewCard from "@/components/reviews/PublicReviewCard";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
type Props = {
  searchParams: Promise<{ sort?: string; verified?: string; photos?: string; minRating?: string; productId?: string; q?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const onlyVerified = params.verified === "1";
  const onlyWithImages = params.photos === "1";
  const productId = params.productId ?? undefined;
  let productTitle: string | undefined;
  if (productId) {
    const product = await getProductByIdFresh(productId);
    productTitle = product?.title;
  }
  const meta = buildReviewListMetadata({
    productId,
    productTitle,
    onlyVerified,
    onlyWithImages,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: meta.canonical,
      siteName: "더올투어",
      type: "website",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
  };
}

export default async function ReviewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  const sort = (params.sort as ReviewSortOption) || "latest";
  const onlyVerified = params.verified === "1";
  const onlyWithImages = params.photos === "1";
  const minRating = params.minRating ? (Number(params.minRating) as 1 | 2 | 3 | 4 | 5) : undefined;
  const productId = params.productId ?? undefined;
  const searchText = typeof params.q === "string" ? params.q : undefined;

  const reviews = await getPublicReviews({
    sort,
    onlyVerified,
    onlyWithImages,
    minRating,
    productId,
    searchText,
    limit: 50,
    offset: 0,
    viewerMemberId: session?.memberId,
  });

  return (
    <div className="min-h-screen page-bg-wash text-content-primary">
      <SiteHeader activeTab="reviews" />

      <SectionBody className="flex flex-col gap-[var(--space-5)]">
        <PageHero
          kicker="THEALL TOUR REVIEWS"
          title="여행후기"
          subtitle="실제 고객님들이 남긴 여행 후기를 카드형으로 한눈에 확인해 보세요."
          size="sm"
        />

        <section className="space-y-4">
          <ReviewSearchBar />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/reviews/write"
              className={cn(
                "type-btn inline-flex rounded-full bg-[var(--accent)] px-5 py-2.5 text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]",
                solidButtonShadowClasses,
              )}
            >
              여행후기 작성하기
            </Link>
            <p className="type-caption text-content-muted">
              등록된 후기 {reviews.length}건
            </p>
          </div>

          <Suspense fallback={<div className="h-14 rounded-xl bg-slate-100" />}>
            <ReviewListFilters />
          </Suspense>

          {reviews.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 shadow-md ring-1 ring-[#e2e8f0]">
              <p className="type-small text-content-muted">조건에 맞는 여행후기가 없습니다.</p>
              <p className="mt-2 type-body text-content-primary">여행을 다녀오셨나요? 후기를 남겨주세요.</p>
              <div className="mt-4">
                <Link
                  href="/reviews/write"
                  className={cn(
                    "type-btn inline-flex rounded-full bg-[var(--accent)] px-5 py-2.5 text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]",
                    solidButtonShadowClasses,
                  )}
                >
                  후기 작성하기
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review) => (
                <PublicReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </section>
      </SectionBody>
    </div>
  );
}
