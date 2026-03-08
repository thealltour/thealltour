/**
 * PR11: 상품 상세 SEO 헬퍼 (Product + AggregateRating + Review JSON-LD).
 */
import "server-only";
import type { PublicReviewItem } from "@/types/review";
import type { ProductReviewStats } from "@/types/review";

const SITE_NAME = "더올투어";

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
}

function toAbsoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return getSiteUrl();
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getSiteUrl()}${path}`;
}

function truncateForMeta(text: string, maxLen = 200): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 1).trim() + "…";
}

export type ProductForSeo = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
};

/**
 * Product + aggregateRating(선택) + review(선택) JSON-LD.
 * - reviewCount 0이면 aggregateRating 생략.
 * - reviews는 최대 3개, reviewBody는 truncate.
 */
export function buildProductReviewJsonLd(
  product: ProductForSeo,
  stats: ProductReviewStats,
  reviews: PublicReviewItem[],
  options?: { productUrl?: string },
): Record<string, unknown> {
  const siteUrl = getSiteUrl();
  const productUrl = options?.productUrl ?? `${siteUrl}/products/${product.id}`;
  const imageUrl = product.image_url?.trim()
    ? toAbsoluteUrl(product.image_url)
    : `${siteUrl}/thealltour-logo.png`;

  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: truncateForMeta(product.description || product.title, 160),
    image: [imageUrl],
    url: productUrl,
    brand: { "@type": "Brand", name: SITE_NAME },
  };

  if (stats.reviewCount > 0) {
    (base as Record<string, unknown>).aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: stats.averageRating,
      reviewCount: stats.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const reviewItems = reviews.slice(0, 3).map((r) => ({
    "@type": "Review" as const,
    author: { "@type": "Person" as const, name: r.author_name || "여행자" },
    datePublished: r.created_at || undefined,
    reviewBody: truncateForMeta(r.summary?.trim() || r.content?.trim() || r.title || "", 300),
    reviewRating:
      typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5
        ? {
            "@type": "Rating" as const,
            ratingValue: r.rating,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  }));
  if (reviewItems.length > 0) {
    (base as Record<string, unknown>).review = reviewItems;
  }

  return base;
}

// TODO(PR14+): 상품별 리뷰 요약(product_review_summaries.summary_text)를
// description 보조 또는 별도 스키마 필드로 활용해 SEO 강화 가능.
