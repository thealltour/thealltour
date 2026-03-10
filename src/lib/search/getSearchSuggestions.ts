import { supabase } from "@/lib/supabase";
import { getDestinationLandingHref, getThemeLandingHref } from "@/lib/hubLandingLinks";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { SearchSuggestion } from "@/types/search";

const MAX_DESTINATION = 3;
const MAX_THEME = 3;
const MAX_PRODUCT = 4;

function rowToTaxonomy(row: Record<string, unknown>, taxonomyType: "destination" | "theme"): ProductTaxonomy {
  return {
    id: String(row.id ?? ""),
    taxonomy_type: taxonomyType,
    name: String(row.name ?? ""),
    slug: typeof row.slug === "string" ? row.slug : null,
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    is_hub_visible: true,
    is_landing_enabled: typeof row.is_landing_enabled === "boolean" ? row.is_landing_enabled : false,
    card_title: typeof row.card_title === "string" ? row.card_title : undefined,
    card_image_url: typeof row.card_image_url === "string" ? row.card_image_url : undefined,
  };
}

/**
 * Hero 검색 자동완성용 추천 리스트.
 * destination(지역) 최대 3, theme(테마) 최대 3, product(상품) 최대 4.
 * 클릭 시 이동할 href는 기존 허브/상세 규칙으로 생성.
 */
export async function getSearchSuggestions(keyword: string): Promise<SearchSuggestion[]> {
  const q = keyword.trim();
  if (!q || q.length < 2) return [];

  const pattern = `%${q}%`;
  const out: SearchSuggestion[] = [];

  try {
    const [destRes, themeRes, productRes] = await Promise.all([
      supabase
        .from("product_taxonomies")
        .select("id, name, slug, is_active, is_landing_enabled, card_title, card_image_url, sort_order, created_at")
        .eq("taxonomy_type", "destination")
        .eq("is_active", true)
        .ilike("name", pattern)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })
        .limit(MAX_DESTINATION),
      supabase
        .from("product_taxonomies")
        .select("id, name, slug, is_active, is_landing_enabled, card_title, card_image_url, sort_order, created_at")
        .eq("taxonomy_type", "theme")
        .eq("is_active", true)
        .ilike("name", pattern)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })
        .limit(MAX_THEME),
      supabase
        .from("products")
        .select("id, title, image_url, category, theme")
        .eq("is_active", true)
        .ilike("title", pattern)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .limit(MAX_PRODUCT),
    ]);

    const seenLabels = new Set<string>();

    for (const row of destRes.data ?? []) {
      const r = row as Record<string, unknown>;
      const tax = rowToTaxonomy(r, "destination");
      const label = (tax.card_title ?? tax.name).trim();
      if (!label || seenLabels.has(`destination:${label}`)) continue;
      seenLabels.add(`destination:${label}`);
      out.push({
        id: `dest-${tax.id}`,
        type: "destination",
        label,
        sublabel: null,
        slug: tax.slug,
        imageUrl: tax.card_image_url ?? null,
        href: getDestinationLandingHref(tax),
      });
    }

    for (const row of themeRes.data ?? []) {
      const r = row as Record<string, unknown>;
      const tax = rowToTaxonomy(r, "theme");
      const label = (tax.card_title ?? tax.name).trim();
      if (!label || seenLabels.has(`theme:${label}`)) continue;
      seenLabels.add(`theme:${label}`);
      out.push({
        id: `theme-${tax.id}`,
        type: "theme",
        label,
        sublabel: null,
        slug: tax.slug,
        imageUrl: tax.card_image_url ?? null,
        href: getThemeLandingHref(tax),
      });
    }

    for (const row of productRes.data ?? []) {
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? "");
      const title = String(r.title ?? "").trim();
      if (!id || !title) continue;
      const category = typeof r.category === "string" ? r.category : "";
      const theme = typeof r.theme === "string" ? r.theme : "";
      const sublabel = [category, theme].filter(Boolean).join(" · ") || null;
      const imageUrl = typeof r.image_url === "string" ? r.image_url : null;
      out.push({
        id: `product-${id}`,
        type: "product",
        label: title,
        sublabel: sublabel || undefined,
        imageUrl,
        href: `/products/${id}`,
      });
    }
  } catch (err) {
    console.error("[search] getSearchSuggestions error:", err);
    return [];
  }

  return out;
}
