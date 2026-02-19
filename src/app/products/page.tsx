import SiteHeader from "@/components/SiteHeader";
import ProductCatalogSection from "@/components/ProductCatalogSection";
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
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 md:px-10">
        <section className="space-y-3">
          <p className="text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR PRODUCTS</p>
          <h1 className="text-3xl font-bold md:text-4xl">패키지상품 전체보기</h1>
          <p className="text-sm text-slate-600">
            카테고리와 테마를 선택해 맞는 상품을 빠르게 찾고, 상세 페이지에서 바로 상담을 연결하세요.
          </p>
        </section>

        {products.length === 0 ? (
          <section className="rounded-2xl bg-white p-8 text-sm text-slate-500 shadow-md ring-1 ring-[#e2e8f0]">
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
