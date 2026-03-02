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
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
        <ProductsHero variant={golfPresetActive ? "golf" : "package"} />

        {products.length === 0 ? (
          <section className="rounded-2xl bg-white p-8 type-small text-content-muted shadow-md ring-1 ring-[#e2e8f0]">
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
