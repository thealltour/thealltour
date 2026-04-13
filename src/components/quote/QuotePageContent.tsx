"use client";

import { useEffect } from "react";
import InquiryForm from "@/components/inquiry/InquiryForm";
import { QuoteSummaryCard } from "@/components/quote/QuoteSummaryCard";
import { trackQuoteView } from "@/lib/analytics/trackLandingQuoteFunnel";
import type { InquiryInput } from "@/types/inquiry";

export type QuoteSummary = {
  productTitle: string;
  duration?: string | null;
  region?: string | null;
  price?: number | null;
};

type QuotePageContentProps = {
  source?: Partial<
    Pick<InquiryInput, "product_id" | "product_title" | "source_path" | "landing_slug" | "quote_category">
  >;
  productSummary?: QuoteSummary | null;
};

export function QuotePageContent({ source, productSummary }: QuotePageContentProps) {
  const productId = source?.product_id?.trim() ?? "";
  const sourcePath = source?.source_path?.trim() ?? "";
  const landingSlug = source?.landing_slug?.trim() ?? "";
  const quoteCategory = source?.quote_category?.trim() ?? "";

  useEffect(() => {
    trackQuoteView({
      sourcePath: sourcePath || undefined,
      landingSlug: landingSlug || undefined,
      quoteCategory: quoteCategory || undefined,
      productId: productId || undefined,
    });
  }, [productId, sourcePath, landingSlug, quoteCategory]);

  return (
    <>
      {productSummary && (
        <div className="mb-6">
          <QuoteSummaryCard
            productTitle={productSummary.productTitle}
            duration={productSummary.duration}
            region={productSummary.region}
            price={productSummary.price}
          />
        </div>
      )}
      <InquiryForm source={source} productIdForTracking={productId || undefined} />
    </>
  );
}
