/**
 * PR11: 리뷰 SEO 헬퍼 (메타데이터, JSON-LD).
 * - submitted 리뷰만 대상. 호출 전에 review 존재 여부 확인 필요.
 *
 * TODO(sitemap): 공개 리뷰 상세 URL을 sitemap에 포함해 검색 유입 강화.
 * TODO(internal linking): 리뷰 수가 많은 상품 우선 상품 상세 ↔ 리뷰 상세 내부 링크 강화.
 */
import "server-only";
import type { PublicReviewItem } from "@/types/review";
import { mediumUrlToOriginalUrl } from "@/lib/reviewImagePolicy";
import { truncateForMeta as truncateForMetaShared } from "@/lib/seo/textTruncation";

const SITE_NAME = "더올투어";
const DEFAULT_DESC_LENGTH = 155;

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
}

function toAbsoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return getSiteUrl();
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getSiteUrl()}${path}`;
}

function truncateForMeta(text: string, maxLen = DEFAULT_DESC_LENGTH): string {
  return truncateForMetaShared(text, maxLen);
}

/** Review(schema.org) JSON-LD 생성. review는 이미 submitted 공개 리뷰로 가정. */
export function buildReviewJsonLd(
  review: PublicReviewItem,
  options?: { pageUrl?: string },
): Record<string, unknown> {
  const siteUrl = getSiteUrl();
  const pageUrl = options?.pageUrl ?? `${siteUrl}/reviews/${review.id}`;
  const reviewBody =
    review.summary?.trim() ||
    (review.content?.trim() ? truncateForMeta(review.content, 500) : "");
  const imageUrls = review.image_urls?.length
    ? review.image_urls
    : review.image_url
      ? [review.image_url]
      : [];
  const images = imageUrls.slice(0, 3).map((u) => toAbsoluteUrl(mediumUrlToOriginalUrl(u)));

  const itemReviewed: Record<string, unknown> = review.product_title
    ? {
        "@type": "Product",
        name: review.product_title,
        ...(review.product_id
          ? { url: `${siteUrl}/products/${review.product_id}` }
          : {}),
      }
    : { "@type": "Thing", name: SITE_NAME };

  return {
    "@context": "https://schema.org",
    "@type": "Review",
    headline: review.title || "여행 후기",
    reviewBody: reviewBody || review.title,
    reviewRating:
      typeof review.rating === "number" && review.rating >= 1 && review.rating <= 5
        ? {
            "@type": "Rating",
            ratingValue: review.rating,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    author: {
      "@type": "Person",
      name: review.author_name || "여행자",
    },
    datePublished: review.created_at || undefined,
    itemReviewed,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl,
    },
    url: pageUrl,
    ...(images.length > 0 ? { image: images } : {}),
  };
}

/** 공개 리뷰 상세용 메타데이터 (generateMetadata에서 사용). review가 null이면 기본값만 반환하거나 상위에서 notFound 처리. */
export function buildReviewDetailMetadata(
  review: PublicReviewItem | null,
  options?: { pageUrl?: string },
): { title: string; description: string; openGraph: Record<string, unknown>; twitter: Record<string, unknown>; canonical: string } | null {
  if (!review) return null;
  const siteUrl = getSiteUrl();
  const pageUrl = options?.pageUrl ?? `${siteUrl}/reviews/${review.id}`;
  const title = review.product_title
    ? `${review.title} | ${review.product_title} 후기 | ${SITE_NAME}`
    : `${review.title} | 여행 후기 | ${SITE_NAME}`;
  const description = truncateForMeta(
    review.summary?.trim() || review.content?.trim() || review.title || "여행 후기",
  );
  const imageUrls = review.image_urls?.length
    ? review.image_urls
    : review.image_url
      ? [review.image_url]
      : [];
  const ogImage = imageUrls[0]
    ? toAbsoluteUrl(imageUrls[0])
    : `${siteUrl}/opengraph-image`;

  return {
    title,
    description,
    canonical: pageUrl,
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: "article",
      siteName: SITE_NAME,
      images: [{ url: ogImage }],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

/** 리뷰 목록 페이지 메타데이터 (필터에 따른 title/description). */
export function buildReviewListMetadata(filters: {
  productId?: string;
  productTitle?: string;
  onlyVerified?: boolean;
  onlyWithImages?: boolean;
}): { title: string; description: string; canonical: string } {
  const siteUrl = getSiteUrl();
  const base = "여행 후기";
  let title = `${base} | ${SITE_NAME}`;
  if (filters.productTitle) {
    title = `${filters.productTitle} 후기 모음 | ${SITE_NAME}`;
  } else if (filters.onlyVerified) {
    title = `인증된 여행 후기 모음 | ${SITE_NAME}`;
  } else if (filters.onlyWithImages) {
    title = `사진 여행 후기 모음 | ${SITE_NAME}`;
  }
  const description =
    filters.productTitle
      ? `${filters.productTitle} 실제 여행자 후기를 확인하세요.`
      : "실제 여행자들의 인증 후기와 사진 후기를 확인하세요.";
  const canonical = filters.productId
    ? `${siteUrl}/reviews?productId=${encodeURIComponent(filters.productId)}`
    : `${siteUrl}/reviews`;

  return { title, description: truncateForMeta(description), canonical };
}
