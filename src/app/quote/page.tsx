import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";
import { QuotePageContent, type QuoteSummary } from "@/components/quote/QuotePageContent";
import { getProductById } from "@/lib/products";

type QuotePageProps = {
  searchParams?: Promise<{
    product_id?: string;
    productId?: string;
    product_title?: string;
    source_path?: string;
    landing_slug?: string;
    quote_category?: string;
    desired_departure?: string;
  }>;
};

export default async function QuotePage({ searchParams }: QuotePageProps) {
  const query = (await searchParams) ?? {};
  const productId = (query.product_id ?? query.productId)?.trim();
  const productTitleFromQuery = query.product_title?.trim();

  let productSummary: QuoteSummary | null = null;
  if (productId) {
    const product = await getProductById(productId);
    if (product) {
      productSummary = {
        productTitle: product.title?.trim() || productTitleFromQuery || "상품",
        duration: product.duration ?? undefined,
        region: product.theme ?? product.overview_region ?? product.departure ?? undefined,
        price: typeof product.price === "number" && product.price > 0 ? product.price : undefined,
      };
    } else if (productTitleFromQuery) {
      productSummary = {
        productTitle: productTitleFromQuery,
        duration: undefined,
        region: undefined,
        price: undefined,
      };
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="quote" />

      <SectionBody className="flex flex-col gap-[var(--space-5)]">
        <PageHero
          kicker="THEALL TOUR QUOTE"
          title="맞춤 견적 문의"
          subtitle="여행 희망 조건을 남겨주시면 접수 순서대로 맞춤 일정과 견적 옵션을 안내드립니다."
          size="sm"
        />

        <ContentCard>
          <div className="mb-6 space-y-2">
            <p className="section-label text-[#B8962E]">THEALL TOUR CONTACT</p>
            <h2 className="section-title type-h2">견적 문의 작성</h2>
            <p className="type-small text-content-secondary">
              간단한 정보만 남겨주시면 확인 후 안내드리겠습니다. 필수 항목만 입력하셔도 상담이 가능합니다.
            </p>
          </div>
          <QuotePageContent
            source={{
              product_id: productId,
              product_title: productSummary?.productTitle ?? query.product_title,
              source_path: query.source_path,
              landing_slug: query.landing_slug,
              quote_category: query.quote_category,
            }}
            productSummary={productSummary}
            initialDesiredDeparture={query.desired_departure?.trim()}
          />
        </ContentCard>
      </SectionBody>
    </div>
  );
}
