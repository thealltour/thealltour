import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import ReviewWriteForm from "@/components/reviews/ReviewWriteForm";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getEligibilityWithBookingById } from "@/lib/reviewEligibilities";
import { getReviewByEligibilityId, getReviewById } from "@/lib/reviews";
import type { Review } from "@/types/review";

type Props = {
  searchParams: Promise<{ eligibility?: string; review?: string }>;
};

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default async function ReviewWritePage({ searchParams }: Props) {
  const params = await searchParams;
  const eligibilityId = params.eligibility;
  const reviewIdParam = params.review;

  let eligibilityInfo: {
    productTitle: string | null;
    departureDate: string | null;
    returnDate: string | null;
    isValid: boolean;
    alreadySubmitted: boolean;
    isOwnedByCurrentUser: boolean;
  } | null = null;

  let initialReview: Review | null = null;
  let effectiveReviewId: string | undefined = reviewIdParam;

  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  if (reviewIdParam) {
    const review = await getReviewById(reviewIdParam);
    if (review && review.status === "draft") {
      initialReview = review;
      if (review.eligibility_id && !eligibilityId) {
        const eligibility = await getEligibilityWithBookingById(review.eligibility_id);
        if (eligibility) {
          eligibilityInfo = {
            productTitle: eligibility.product_title,
            departureDate: eligibility.departure_date,
            returnDate: eligibility.return_date,
            isValid: true,
            alreadySubmitted: false,
            isOwnedByCurrentUser: !!session && eligibility.claimed_by_member_id === session.memberId,
          };
        }
      }
    }
  }

  if (eligibilityId) {
    const eligibility = await getEligibilityWithBookingById(eligibilityId);
    if (eligibility) {
      const existingReview = await getReviewByEligibilityId(eligibilityId);

      if (existingReview && existingReview.status === "draft") {
        initialReview = existingReview;
        effectiveReviewId = existingReview.id;
      }

      eligibilityInfo = {
        productTitle: eligibility.product_title,
        departureDate: eligibility.departure_date,
        returnDate: eligibility.return_date,
        isValid: true,
        alreadySubmitted: !!(existingReview && existingReview.status === "submitted"),
        isOwnedByCurrentUser: !!session && eligibility.claimed_by_member_id === session.memberId,
      };
    } else {
      eligibilityInfo = {
        productTitle: null,
        departureDate: null,
        returnDate: null,
        isValid: false,
        alreadySubmitted: false,
        isOwnedByCurrentUser: false,
      };
    }
  }

  const showInvalidWarning = eligibilityId && eligibilityInfo && !eligibilityInfo.isValid;
  const showAlreadySubmittedWarning = eligibilityId && eligibilityInfo?.alreadySubmitted;
  const showNotOwnerWarning =
    eligibilityId && eligibilityInfo && eligibilityInfo.isValid && !eligibilityInfo.isOwnedByCurrentUser;

  const pageTitle = eligibilityInfo?.productTitle
    ? `${eligibilityInfo.productTitle} 후기 작성`
    : "여행후기 작성";

  const productInfo = eligibilityInfo?.isValid
    ? {
        title: eligibilityInfo.productTitle ?? undefined,
        departureDate: eligibilityInfo.departureDate ?? undefined,
        returnDate: eligibilityInfo.returnDate ?? undefined,
      }
    : undefined;

  return (
    <div className="min-h-screen page-bg-wash text-content-primary">
      <SiteHeader activeTab="reviews" />
      <SectionBody className="flex flex-col gap-[var(--space-5)]">
        <PageHero
          kicker="THEALL TOUR REVIEWS"
          title={pageTitle}
          subtitle={
            productInfo
              ? "여행 경험을 공유하면 다른 여행자에게 큰 도움이 됩니다. 아래 단계를 따라 작성해 주세요."
              : "실제 여행 경험을 남겨주시면 더올투어를 찾는 분들께 큰 도움이 됩니다."
          }
          size="sm"
        />
        <p className="-mt-2 text-center text-sm text-slate-600">
          평균 작성 시간 2~3분 · 사진은 선택 항목입니다
        </p>
        <ContentCard>
          {showNotOwnerWarning ? (
            <div className="space-y-4 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-bg)] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger)]/15">
                <svg className="h-6 w-6 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--danger)]">본인에게 부여된 후기 작성 권한이 아닙니다.</p>
                <p className="mt-1 text-sm text-[var(--danger)]">마이페이지에서 작성 가능한 후기를 확인해주세요.</p>
              </div>
              <Link
                href="/mypage/reviews"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--danger)] hover:opacity-80"
              >
                마이페이지로 이동 →
              </Link>
            </div>
          ) : showInvalidWarning ? (
            <div className="space-y-4 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-bg)] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger)]/15">
                <svg className="h-6 w-6 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--danger)]">유효하지 않은 후기 작성 링크입니다.</p>
                <p className="mt-1 text-sm text-[var(--danger)]">마이페이지에서 작성 가능한 후기를 확인해주세요.</p>
              </div>
              <Link
                href="/mypage/reviews"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--danger)] hover:opacity-80"
              >
                마이페이지로 이동 →
              </Link>
            </div>
          ) : showAlreadySubmittedWarning ? (
            <div className="space-y-4 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-bg)] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--warning)]/15">
                <svg className="h-6 w-6 text-[var(--warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--warning)]">이미 작성 완료된 후기입니다.</p>
                <p className="mt-1 text-sm text-[var(--warning)]">마이페이지에서 작성한 후기를 확인할 수 있습니다.</p>
              </div>
              <Link
                href="/mypage/reviews"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--warning)] hover:opacity-80"
              >
                내 후기 보기 →
              </Link>
            </div>
          ) : (
            <ReviewWriteForm
              eligibilityId={eligibilityId}
              reviewId={effectiveReviewId}
              initialData={initialReview}
              productInfo={productInfo}
            />
          )}
        </ContentCard>
      </SectionBody>
    </div>
  );
}
