import SiteHeader from "@/components/SiteHeader";
import ProductsHero from "@/components/ProductsHero";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import { getProducts } from "@/lib/products";
import { getProductTaxonomyOptions } from "@/lib/productTaxonomies";

type ProductsPageProps = {
  searchParams?: Promise<{ q?: string; tourType?: string; region?: string; theme?: string; sort?: string }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const query = (await searchParams) ?? {};
  const searchKeyword = query.q?.trim() ?? "";
  const tourType = query.tourType?.trim() ?? "";
  const golfPresetActive = tourType === "golf-park";
  const presetCategories = golfPresetActive ? ["골프투어", "파크골프투어"] : undefined;
  const products = await getProducts();
  const { categories, themes } = await getProductTaxonomyOptions(products);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />

      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10 md:px-10 md:py-14">
        <div className="flex flex-col gap-8">
          <ProductsHero variant={golfPresetActive ? "golf" : "package"} />

          {products.length === 0 ? (
            <section className="rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-8 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] type-small text-[var(--text-muted)]">
              현재 등록된 상품이 없습니다. 관리자 페이지에서 상품을 등록해 주세요.
            </section>
          ) : (
            <ProductsPageContent
              products={products}
              regionOptions={categories}
              themeOptions={themes}
              initialKeyword={searchKeyword}
              presetCategories={presetCategories}
              presetLabel={golfPresetActive ? "골프/파크골프" : undefined}
            />
          )}
        </div>
      </main>
    </div>
  );
}
