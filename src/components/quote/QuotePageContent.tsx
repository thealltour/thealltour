"use client";

import { useEffect } from "react";
import InquiryForm from "@/components/InquiryForm";
import { QuoteSummaryCard } from "@/components/quote/QuoteSummaryCard";
import { trackQuotePageView } from "@/lib/analytics/trackQuoteEvent";
import type { InquiryInput } from "@/types/inquiry";

export type QuoteSummary = {
  productTitle: string;
  duration?: string | null;
  region?: string | null;
  price?: number | null;
};

type QuotePageContentProps = {
  source?: Partial<Pick<InquiryInput, "product_id" | "product_title" | "source_path">>;
  productSummary?: QuoteSummary | null;
};

export function QuotePageContent({ source, productSummary }: QuotePageContentProps) {
  const productId = source?.product_id?.trim() ?? "";

  useEffect(() => {
    trackQuotePageView(productId || undefined);
  }, [productId]);

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
