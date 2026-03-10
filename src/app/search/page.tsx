import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { searchProductsByParams } from "@/lib/search/searchProducts";
import { getSearchFilterOptions } from "@/lib/search/getSearchFilterOptions";
import { getSearchRecommendations } from "@/lib/search/getSearchRecommendations";
import { parseSearchParams } from "@/lib/search/searchQueryParams";
import { buildSearchQueryString } from "@/lib/search/searchQueryParams";
import SearchResultsHeader from "@/components/search/SearchResultsHeader";
import SearchFilters from "@/components/search/SearchFilters";
import SearchResults from "@/components/search/SearchResults";
import SearchResultsContainer from "@/components/search/SearchResultsContainer";
import SearchEmpty from "@/components/search/SearchEmpty";
import RelatedDestinationSection from "@/components/search/RelatedDestinationSection";
import RelatedThemeSection from "@/components/search/RelatedThemeSection";
import RelatedProductsSection from "@/components/search/RelatedProductsSection";
import SiteHeader from "@/components/SiteHeader";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    destination?: string;
    theme?: string;
    product_line?: string;
    sort?: string;
    page?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const state = parseSearchParams(params as Record<string, string | string[] | undefined>);

  const hasCondition = state.q || state.destination || state.theme || state.product_line;

  const [result, filterOptions] = await Promise.all([
    hasCondition
      ? searchProductsByParams({
          q: state.q,
          destination: state.destination ?? null,
          theme: state.theme ?? null,
          product_line: state.product_line ?? null,
          sort: state.sort,
          page: state.page ?? 1,
        })
      : Promise.resolve({ items: [], totalCount: 0, page: 1, pageSize: 24, totalPages: 0 }),
    getSearchFilterOptions(),
  ]);

  const recommendations = hasCondition
    ? await getSearchRecommendations({
        q: state.q,
        destination: state.destination ?? null,
        theme: state.theme ?? null,
        product_line: state.product_line ?? null,
        products: result.items,
      })
    : { destinations: [], themes: [], products: [] };

  const products = result.items;
  const totalCount = result.totalCount;
  const totalPages = result.totalPages;
  const currentPage = result.page;

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
        <main className="py-6 sm:py-10 md:py-14">
          <PageContainer size="wide" className="flex flex-col gap-6">
            <SearchResultsHeader
              current={state}
              totalCount={totalCount}
              totalPages={totalPages}
              currentPage={currentPage}
            />

            {hasCondition && (
              <SearchFilters current={state} options={filterOptions} />
            )}

            {!hasCondition && (
              <div className="rounded-2xl bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
                <p className="font-semibold text-[var(--text-primary)]">검색 결과</p>
                <p className="mt-2 type-small text-[var(--text-muted)]">
                  검색어를 입력하거나 지역/테마 필터를 선택해 주세요.
                </p>
                <p className="mt-4 type-small text-[var(--text-muted)]">
                  상단 Hero 검색창에서 키워드를 입력하면 결과를 볼 수 있습니다.
                </p>
              </div>
            )}

            <Suspense
              fallback={
                <div className="type-small text-[var(--text-muted)]">검색 결과를 불러오는 중...</div>
              }
            >
              {hasCondition && totalCount === 0 && (
                <SearchEmpty keyword={state.q} current={state} />
              )}
              {hasCondition && products.length > 0 && totalPages > 1 && (
                <SearchResultsContainer
                  key={`search-${buildSearchQueryString(state)}`}
                  initialItems={products}
                  initialPage={currentPage}
                  totalPages={totalPages}
                  query={state}
                />
              )}
              {hasCondition && products.length > 0 && totalPages <= 1 && (
                <SearchResults products={products} />
              )}
            </Suspense>

            {hasCondition && (
              <>
                {recommendations.destinations.length > 0 && (
                  <RelatedDestinationSection
                    items={recommendations.destinations}
                    query={state.q}
                  />
                )}
                {recommendations.themes.length > 0 && (
                  <RelatedThemeSection
                    items={recommendations.themes}
                    query={state.q}
                  />
                )}
                {recommendations.products.length > 0 && (
                  <RelatedProductsSection
                    title={totalCount > 0 ? "이런 상품도 있어요" : "추천 여행 상품"}
                    products={recommendations.products}
                  />
                )}
              </>
            )}
          </PageContainer>
        </main>
      </div>
    </>
  );
}
