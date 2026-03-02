import type { Product } from "@/types/product";
import { parseThemeTokens } from "@/lib/productTaxonomies";

export type ProductCategoryTabId = string;

const PRIMARY_BADGE_ORDER = ["제철", "인기", "마감임박"];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function splitTheme(theme: string | undefined) {
  return parseThemeTokens(theme);
}

export function getProductBadges(product: Product) {
  const values = splitTheme(product.theme);
  const unique = Array.from(new Set(values));
  const prioritized = PRIMARY_BADGE_ORDER.filter((badge) => unique.includes(badge));
  const rest = unique.filter((badge) => !PRIMARY_BADGE_ORDER.includes(badge));
  return [...prioritized, ...rest].slice(0, 3);
}

export function matchesProductTab(product: Product, tab: ProductCategoryTabId) {
  if (tab === "all") return true;
  return normalize(product.category ?? "") === normalize(tab);
}

export function getThemeTabs(products: Product[], currentCategory: string) {
  const inCategory =
    currentCategory === "all"
      ? products
      : products.filter((product) => matchesProductTab(product, currentCategory));
  const themes = Array.from(new Set(inCategory.flatMap((product) => splitTheme(product.theme))));
  return ["전체", ...themes];
}

export function matchesThemeTab(product: Product, themeTab: string) {
  if (themeTab === "전체") return true;
  return splitTheme(product.theme).includes(themeTab);
}

export function groupProductsByTheme(products: Product[], themeTabs: string[]) {
  const themeNames = themeTabs.filter((t) => t !== "전체");
  const groups = themeNames
    .map((theme) => ({
      theme,
      products: products.filter((product) => matchesThemeTab(product, theme)),
    }))
    .filter((group) => group.products.length > 0);

  // 테마가 없거나 기존 테마 그룹에 속하지 않는 상품 → "기타" 그룹에 포함
  const productIdsInGroups = new Set(groups.flatMap((g) => g.products.map((p) => p.id)));
  const ungrouped = products.filter((p) => !productIdsInGroups.has(p.id));
  if (ungrouped.length > 0) {
    return [...groups, { theme: "기타", products: ungrouped }];
  }
  return groups;
}
