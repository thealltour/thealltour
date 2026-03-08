/**
 * PR22: 상품 상세용 리뷰 JSON-LD 스크립트 컴포넌트.
 * 데이터는 상위에서 주입, 생성 실패 시 렌더 없음.
 */
import {
  buildProductReviewStructuredData,
  serializeStructuredData,
} from "@/lib/reviewStructuredData";
import type { ReviewForSeoEligibility } from "@/lib/reviewSeoVisibility";
import type { ProductReviewStructuredData } from "@/types/reviewSeo";

export type ProductLike = {
  name: string;
  id?: string;
};

export type ProductReviewJsonLdProps = {
  product: ProductLike;
  reviews: ReviewForSeoEligibility[];
  options?: {
    minTrustScore?: number;
    minLength?: number;
    minAggregateCount?: number;
    maxRepresentative?: number;
  };
};

export function ProductReviewJsonLd({
  product,
  reviews,
  options,
}: ProductReviewJsonLdProps) {
  const data: ProductReviewStructuredData | null = buildProductReviewStructuredData(
    product,
    reviews,
    options,
  );
  const json = serializeStructuredData(data);
  if (!json || json === "null") return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
