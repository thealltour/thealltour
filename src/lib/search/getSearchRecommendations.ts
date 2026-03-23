import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { SearchRecommendations } from "@/types/search";
import { getHubDestinations, getHubThemes } from "@/lib/productTaxonomies";
import { parseThemeTokens } from "@/lib/productTaxonomies";
import { searchProductsByParams } from "@/lib/search/searchProducts";
import { getHomeCuratedData } from "@/lib/homeCurated";
import { supabase } from "@/lib/supabase";
import { normalizeProduct } from "@/lib/products";
import { getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";

const MAX_DESTINATIONS = 6;
const MAX_THEMES = 6;
const MAX_PRODUCTS = 8;

function normalizeStr(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase();
}

/** category 이름으로 destination taxonomy 매칭 (name 일치 또는 포함) */
function matchDestinationByName(all: ProductTaxonomy[], name: string): ProductTaxonomy | undefined {
  const n = normalizeStr(name);
  if (!n) return undefined;
  const exact = all.find((d) => normalizeStr(d.name) === n);
  if (exact) return exact;
  return all.find((d) => normalizeStr(d.name).includes(n) || n.includes(normalizeStr(d.name)));
}

/** theme 이름으로 theme taxonomy 매칭 */
function matchThemeByName(all: ProductTaxonomy[], name: string): ProductTaxonomy | undefined {
  const n = normalizeStr(name);
  if (!n) return undefined;
  const exact = all.find((t) => normalizeStr(t.name) === n);
  if (exact) return exact;
  return all.find((t) => normalizeStr(t.name).includes(n) || n.includes(normalizeStr(t.name)));
}

/**
 * 검색 결과 페이지용 연관 추천 데이터 생성.
 * - destinations: 결과 상품의 category 기반 → taxonomy 매칭 → fallback 허브 지역
 * - themes: 결과 상품의 theme 토큰 기반 → taxonomy 매칭 → fallback 허브 테마
 * - products: 현재 페이지 제외한 검색 결과 또는 home_curated / sort_order 상위
 */
export async function getSearchRecommendations(params: {
  q?: string;
  destination?: string | null;
  theme?: string | null;
  product_line?: string | null;
  products?: Product[];
}): Promise<SearchRecommendations> {
  const q = params.q?.trim();
  const currentDestination = normalizeStr(params.destination);
  const currentTheme = normalizeStr(params.theme);
  const currentProductIds = new Set((params.products ?? []).map((p) => p.id));

  const [hubDestinations, hubThemes] = await Promise.all([
    getHubDestinations(),
    getHubThemes(),
  ]);

  const destinations = await resolveDestinations({
    products: params.products ?? [],
    hubDestinations,
    currentDestination,
    q,
  });

  const themes = await resolveThemes({
    products: params.products ?? [],
    hubThemes,
    currentTheme,
    q,
  });

  const products = await resolveRecommendedProducts({
    q: params.q ?? undefined,
    destination: params.destination ?? null,
    theme: params.theme ?? null,
    product_line: params.product_line ?? null,
    excludeIds: currentProductIds,
  });

  return { destinations, themes, products };
}

function resolveDestinations(opts: {
  products: Product[];
  hubDestinations: ProductTaxonomy[];
  currentDestination: string;
  q?: string;
}): ProductTaxonomy[] {
  const seen = new Set<string>();
  const out: ProductTaxonomy[] = [];

  for (const p of opts.products) {
    const cat = (p.category ?? "").trim();
    if (!cat) continue;
    const tax = matchDestinationByName(opts.hubDestinations, cat);
    if (tax && !seen.has(tax.id) && normalizeStr(tax.name) !== opts.currentDestination) {
      seen.add(tax.id);
      out.push(tax);
      if (out.length >= MAX_DESTINATIONS) return out;
    }
  }

  if (out.length >= MAX_DESTINATIONS) return out;

  for (const d of opts.hubDestinations) {
    if (seen.has(d.id)) continue;
    if (normalizeStr(d.name) === opts.currentDestination) continue;
    if (!d.is_active) continue;
    out.push(d);
    seen.add(d.id);
    if (out.length >= MAX_DESTINATIONS) break;
  }

  return out.slice(0, MAX_DESTINATIONS);
}

function resolveThemes(opts: {
  products: Product[];
  hubThemes: ProductTaxonomy[];
  currentTheme: string;
  q?: string;
}): ProductTaxonomy[] {
  const seen = new Set<string>();
  const out: ProductTaxonomy[] = [];

  for (const p of opts.products) {
    const tokens = parseThemeTokens(p.theme);
    for (const token of tokens) {
      if (!token.trim()) continue;
      const tax = matchThemeByName(opts.hubThemes, token);
      if (tax && !seen.has(tax.id) && normalizeStr(tax.name) !== opts.currentTheme) {
        seen.add(tax.id);
        out.push(tax);
        if (out.length >= MAX_THEMES) return out;
      }
    }
  }

  if (out.length >= MAX_THEMES) return out;

  for (const t of opts.hubThemes) {
    if (seen.has(t.id)) continue;
    if (normalizeStr(t.name) === opts.currentTheme) continue;
    if (!t.is_active) continue;
    out.push(t);
    seen.add(t.id);
    if (out.length >= MAX_THEMES) break;
  }

  return out.slice(0, MAX_THEMES);
}

async function resolveRecommendedProducts(opts: {
  q?: string;
  destination?: string | null;
  theme?: string | null;
  product_line?: string | null;
  excludeIds: Set<string>;
}): Promise<Product[]> {
  const hasCondition = opts.q || opts.destination || opts.theme || opts.product_line;
  const out: Product[] = [];

  if (hasCondition) {
    const result = await searchProductsByParams({
      q: opts.q ?? undefined,
      destination: opts.destination ?? null,
      theme: opts.theme ?? null,
      product_line: opts.product_line ?? null,
      sort: "relevance",
      page: 2,
      pageSize: MAX_PRODUCTS + 10,
    });
    for (const p of result.items) {
      if (opts.excludeIds.has(p.id)) continue;
      out.push(p);
      if (out.length >= MAX_PRODUCTS) break;
    }
  }

  if (out.length >= MAX_PRODUCTS) return out;

  const curated = await getHomeCuratedData();
  for (const section of curated.sections ?? []) {
    for (const p of section.products ?? []) {
      if (opts.excludeIds.has(p.id)) continue;
      if (out.some((x) => x.id === p.id)) continue;
      out.push(p);
      if (out.length >= MAX_PRODUCTS) return out;
    }
  }

  if (out.length >= MAX_PRODUCTS) return out;

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(MAX_PRODUCTS + opts.excludeIds.size);

  const rows = (data ?? []) as Record<string, unknown>[];
  for (const row of rows) {
    const p = normalizeProduct(row);
    if (opts.excludeIds.has(p.id)) continue;
    if (out.some((x) => x.id === p.id)) continue;
    out.push(p);
    if (out.length >= MAX_PRODUCTS) break;
  }

  const campaignTax = await getCampaignTaxonomiesForCard();
  return hydrateProductsWithCampaignCardMeta(out.slice(0, MAX_PRODUCTS), campaignTax);
}
