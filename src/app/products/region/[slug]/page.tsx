import { redirect } from "next/navigation";
import { getTaxonomyNameBySlug, getHubDestinations } from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import { getProducts } from "@/lib/products";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import SiteHeader from "@/components/SiteHeader";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

type RegionLandingProps = {
  params: Promise<{ slug: string }>;
};

/** 카드 이미지 미설정 시 해당 지역 상품 대표 이미지로 채움. */
function buildDestinationFallbackImageMap(
  destinations: ProductTaxonomy[],
  products: Product[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of destinations) {
    const first = products.find(
      (p) =>
        p.image_url?.trim() &&
        (p.destination_id === d.id ||
          p.category?.trim().toLowerCase() === d.name.trim().toLowerCase()),
    );
    if (first?.image_url?.trim()) {
      map.set(d.id, first.image_url.trim());
      map.set(d.name.trim().toLowerCase(), first.image_url.trim());
    }
  }
  return map;
}

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
    let dataWithChildren = landingData;
    const [allDestinations, products] = await Promise.all([
      getHubDestinations(),
      getProducts(),
    ]);
    const normalizedSlug = trimmedSlug.toLowerCase().replace(/\s+/g, "-");
    const parent = allDestinations.find(
      (d) =>
        (d.slug?.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug) ||
        d.name?.trim() === landingData.taxonomyName,
    );
    if (parent) {
      const parentId = parent.id.trim();
      const childDestinations = allDestinations
        .filter((d) => (d.parent_id ?? "").trim() === parentId)
        .sort((a, b) => {
          const sa = a.sort_order ?? 9999;
          const sb = b.sort_order ?? 9999;
          if (sa !== sb) return sa - sb;
          return (a.name ?? "").localeCompare(b.name ?? "", "ko");
        });
      const fallbackMap = buildDestinationFallbackImageMap(childDestinations, products);
      const childDestinationsWithImages = childDestinations.map((d) => {
        const cardImageUrl =
          d.card_image_url?.trim() ||
          fallbackMap.get(d.id) ||
          fallbackMap.get(d.name.trim().toLowerCase()) ||
          undefined;
        return { ...d, card_image_url: cardImageUrl ?? d.card_image_url };
      });
      dataWithChildren = { ...landingData, childDestinations: childDestinationsWithImages };
    }
    return (
      <>
        <SiteHeader activeTab="products" />
        <ProductLandingPage data={dataWithChildren} />
      </>
    );
  }

  if (!name) {
    redirect("/products");
  }
  redirect(`/products?region=${encodeURIComponent(name)}`);
}
