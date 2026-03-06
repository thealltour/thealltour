import { redirect } from "next/navigation";
import { getTaxonomyNameBySlug } from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import SiteHeader from "@/components/SiteHeader";

type RegionLandingProps = {
  params: Promise<{ slug: string }>;
};

/**
 * 지역 랜딩: /products/region/[slug]
 * 랜딩 데이터가 유효하면 새 랜딩 UI 렌더, 아니면 기존대로 /products?region={name} redirect.
 */
export default async function ProductsRegionSlugPage({ params }: RegionLandingProps) {
  const { slug } = await params;
  const trimmedSlug = slug?.trim();
  if (!trimmedSlug) {
    redirect("/products");
  }

  const landingData = await getProductLandingData({ type: "region", slug: trimmedSlug });
  const name = await getTaxonomyNameBySlug("category", trimmedSlug);

  if (landingData && landingData.taxonomyName && landingData.hero?.primaryCtaHref) {
    return (
      <>
        <SiteHeader activeTab="products" />
        <ProductLandingPage data={landingData} />
      </>
    );
  }

  if (!name) {
    redirect("/products");
  }
  redirect(`/products?region=${encodeURIComponent(name)}`);
}
