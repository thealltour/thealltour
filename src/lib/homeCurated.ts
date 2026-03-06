import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { normalizeProduct } from "@/lib/products";
import type {
  HomeCuratedSettings,
  HomeCuratedSection,
  HomeCuratedSectionWithProducts,
  HomeCuratedData,
} from "@/types/homeCurated";

function normalizeSettings(row: Record<string, unknown>): HomeCuratedSettings {
  return {
    id: String(row.id ?? ""),
    setting_key: String(row.setting_key ?? ""),
    section_label: String(row.section_label ?? ""),
    section_title: String(row.section_title ?? ""),
    section_description: String(row.section_description ?? ""),
    catalog_button_label: String(row.catalog_button_label ?? ""),
    catalog_button_href: String(row.catalog_button_href ?? "/products"),
    is_active: row.is_active === true,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function normalizeSection(row: Record<string, unknown>): HomeCuratedSection {
  return {
    id: String(row.id ?? ""),
    setting_id: String(row.setting_id ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    max_items: typeof row.max_items === "number" ? Math.max(0, row.max_items) : 8,
    is_active: row.is_active === true,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

async function getHomeCuratedDataUncached(): Promise<HomeCuratedData> {
  try {
    const { data: settingRow, error: settingError } = await supabase
      .from("home_curated_settings")
      .select("*")
      .eq("setting_key", "home_curated")
      .maybeSingle();

    if (settingError || !settingRow) {
      return { settings: null, sections: [] };
    }

    const settings = normalizeSettings(settingRow as Record<string, unknown>);
    if (!settings.is_active) {
      return { settings, sections: [] };
    }

    const { data: sectionRows, error: sectionsError } = await supabase
      .from("home_curated_sections")
      .select("*")
      .eq("setting_id", settings.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (sectionsError || !sectionRows?.length) {
      return { settings, sections: [] };
    }

    const sections = sectionRows.map((r) => normalizeSection(r as Record<string, unknown>));
    const sectionIds = sections.map((s) => s.id);

    const { data: spRows, error: spError } = await supabase
      .from("home_curated_section_products")
      .select("id, section_id, product_id, sort_order")
      .in("section_id", sectionIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (spError || !spRows?.length) {
      return {
        settings,
        sections: sections.map((s) => ({ ...s, products: [] })),
      };
    }

    const productIds = [...new Set(spRows.map((r) => String(r.product_id)))];
    const { data: productRows, error: productsError } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds)
      .eq("is_active", true);

    const productMap = new Map<string, ReturnType<typeof normalizeProduct>>();
    if (!productsError && productRows?.length) {
      for (const row of productRows) {
        const p = normalizeProduct(row as Record<string, unknown>);
        productMap.set(p.id, p);
      }
    }

    const sectionProductsBySection = new Map<string, Array<{ product_id: string }>>();
    for (const sp of spRows) {
      const sid = String(sp.section_id);
      if (!sectionProductsBySection.has(sid)) {
        sectionProductsBySection.set(sid, []);
      }
      sectionProductsBySection.get(sid)!.push({ product_id: String(sp.product_id) });
    }

    const sectionsWithProducts: HomeCuratedSectionWithProducts[] = sections.map((sec) => {
      const order = sectionProductsBySection.get(sec.id) ?? [];
      const products = order
        .map((o) => productMap.get(o.product_id))
        .filter((p): p is NonNullable<typeof p> => p != null)
        .slice(0, sec.max_items);
      return { ...sec, products };
    });

    return { settings, sections: sectionsWithProducts };
  } catch {
    return { settings: null, sections: [] };
  }
}

export async function getHomeCuratedData(): Promise<HomeCuratedData> {
  return unstable_cache(getHomeCuratedDataUncached, ["home-curated-data"], {
    revalidate: 60,
    tags: [CACHE_TAGS.HOME_CURATED],
  })();
}
