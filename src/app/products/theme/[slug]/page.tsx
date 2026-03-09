import { redirect } from "next/navigation";
import {
  getTaxonomyNameBySlug,
  getHubThemes,
  parseThemeTokens,
} from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import { getProducts } from "@/lib/products";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import SiteHeader from "@/components/SiteHeader";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

type ThemeLandingProps = {
  params: Promise<{ slug: string }>;
};

/** 카드 이미지 미설정 시 해당 테마 상품 대표 이미지로 채움. */
function buildThemeFallbackImageMap(
  themes: ProductTaxonomy[],
  products: Product[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of themes) {
    const nameLower = t.name.trim().toLowerCase();
    if (map.has(nameLower)) continue;
    const first = products.find(
      (p) =>
        p.image_url?.trim() &&
        parseThemeTokens(p.theme).map((x) => x.trim().toLowerCase()).includes(nameLower),
    );
    if (first?.image_url?.trim()) map.set(nameLower, first.image_url.trim());
  }
  return map;
}

/**
 * 테마 랜딩: /products/theme/[slug]
 * 랜딩 데이터가 유효하면 새 랜딩 UI 렌더, 아니면 기존대로 /products?theme={name} redirect.
 */
export default async function ProductsThemeSlugPage({ params }: ThemeLandingProps) {
  const { slug } = await params;
  const trimmedSlug = slug?.trim();
  if (!trimmedSlug) {
    redirect("/products");
  }

  const landingData = await getProductLandingData({ type: "theme", slug: trimmedSlug });
  const name = await getTaxonomyNameBySlug("theme", trimmedSlug);

  if (landingData && landingData.taxonomyName && landingData.hero?.primaryCtaHref) {
    let dataWithChildren = landingData;
    const [allThemes, products] = await Promise.all([
      getHubThemes(),
      getProducts(),
    ]);
    const normalizedSlug = trimmedSlug.toLowerCase().replace(/\s+/g, "-");
    const parent = allThemes.find(
      (t) =>
        (t.slug?.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug) ||
        t.name?.trim() === landingData.taxonomyName,
    );
    if (parent) {
      const parentId = parent.id.trim();
      const childThemes = allThemes
        .filter((t) => (t.parent_id ?? "").trim() === parentId)
        .sort((a, b) => {
          const sa = a.sort_order ?? 9999;
          const sb = b.sort_order ?? 9999;
          if (sa !== sb) return sa - sb;
          return (a.name ?? "").localeCompare(b.name ?? "", "ko");
        });
      const fallbackMap = buildThemeFallbackImageMap(childThemes, products);
      const childThemesWithImages = childThemes.map((t) => {
        const nameKey = t.name.trim().toLowerCase();
        const cardImageUrl =
          t.card_image_url?.trim() ||
          fallbackMap.get(nameKey) ||
          undefined;
        return { ...t, card_image_url: cardImageUrl ?? t.card_image_url };
      });
      dataWithChildren = { ...landingData, childThemes: childThemesWithImages };
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
  redirect(`/products?theme=${encodeURIComponent(name)}`);
}
