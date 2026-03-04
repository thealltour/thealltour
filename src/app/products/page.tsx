import SiteHeader from "@/components/SiteHeader";
import ProductCatalogSection from "@/components/ProductCatalogSection";
import ProductsHero from "@/components/ProductsHero";
// 패키지상품 목록: 전체 상품 노출. 추천(is_featured_home) 필터는 홈에서만 사용
import { getProducts } from "@/lib/products";
import { getProductTaxonomyOptions } from "@/lib/productTaxonomies";

type ProductsPageProps = {
  searchParams?: Promise<{ q?: string; tourType?: string }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const query = (await searchParams) ?? {};
  const searchKeyword = query.q?.trim() ?? "";
  const tourType = query.tourType?.trim() ?? "";
  const golfPresetActive = tourType === "golf-park";
  const presetCategories = golfPresetActive ? ["골프투어", "파크골프투어"] : undefined;
  const products = await getProducts();
  const { categories } = await getProductTaxonomyOptions(products);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-3 py-6 sm:px-6 sm:py-10 md:px-10 md:py-14">
        <ProductsHero variant={golfPresetActive ? "golf" : "package"} />

        {products.length === 0 ? (
          <section className="rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-8 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] type-small text-[var(--text-muted)]">
            현재 등록된 상품이 없습니다. 관리자 페이지에서 상품을 등록해 주세요.
          </section>
        ) : (
          <ProductCatalogSection
            products={products}
            categories={categories}
            initialKeyword={searchKeyword}
            presetCategories={presetCategories}
            presetLabel={golfPresetActive ? "골프/파크골프" : undefined}
          />
        )}
      </main>
    </div>
  );
}
