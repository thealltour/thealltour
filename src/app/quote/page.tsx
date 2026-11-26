import SiteHeader from "@/components/site-chrome/SiteHeader";
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
    <div className="min-h-screen page-bg-wash text-content-primary">
      <SiteHeader activeTab="quote" />

      <SectionBody className="flex flex-col gap-[var(--space-5)]">
        <header className="space-y-1">
          <h1 className="type-h2 text-content-primary">맞춤 견적 문의</h1>
          <p className="type-small text-content-secondary">
            이름과 연락처만 남겨도 상담이 가능합니다.
          </p>
        </header>

        <ContentCard>
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
