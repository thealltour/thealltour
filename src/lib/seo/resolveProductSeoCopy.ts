import type { Product } from "@/types/product";
import { productSeoCopy, type ProductSeoCopy, type ProductSeoCopyKey } from "@/lib/seo/productSeoCopy";

/**
 * 상품 메타·OG 패턴 매칭용 문자열 (URL id, 제목, 카테고리, 테마, 지역, 태그 등).
 */
export function buildProductSeoMatchSource(product: Product): string {
  const parts: string[] = [
    product.id,
    product.title,
    product.category,
    product.theme ?? "",
    product.overview_region ?? "",
    ...(product.tags ?? []),
    ...(product.campaigns ?? []),
    ...(product.highlights ?? []),
  ];
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

/** 키워드 출현 순서: 더 구체적인 패턴을 먼저 두지 않아도 되는 항목 위주. */
const MATCH_ORDER: Array<{ needles: string[]; key: ProductSeoCopyKey }> = [
  { needles: ["bali"], key: "bali" },
  { needles: ["danang", "da-nang", "da nang"], key: "danang" },
  { needles: ["japan", "일본"], key: "japan" },
  { needles: ["jeju", "제주"], key: "jeju" },
  { needles: ["filial", "효도"], key: "filial" },
  { needles: ["family", "가족"], key: "family" },
  { needles: ["premium", "프리미엄"], key: "premium" },
];

/**
 * 소스 문자열(소문자 권장)에 키워드가 포함되면 해당 상품군 카피 반환.
 */
export function resolveProductSeoCopy(source: string): ProductSeoCopy | null {
  const s = source.trim().toLowerCase();
  if (!s) return null;
  for (const { needles, key } of MATCH_ORDER) {
    if (needles.some((n) => s.includes(n))) {
      return productSeoCopy[key];
    }
  }
  return null;
}

export function resolveProductSeoCopyFromProduct(product: Product): ProductSeoCopy | null {
  return resolveProductSeoCopy(buildProductSeoMatchSource(product));
}
