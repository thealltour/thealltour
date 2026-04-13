import { supabase } from "@/lib/supabase";
import { parseThemeTokens } from "@/lib/productTaxonomies";

type RawTaxonomy = {
  id: string;
  taxonomy_type: "destination" | "theme" | "product_line";
  name: string;
  slug: string | null;
};

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function isMissingColumnError(message: string): boolean {
  return /column .* does not exist/i.test(message) || /Could not find the '.*' column/i.test(message);
}

export async function resolveDestinationProductCounts(
  taxonomies: RawTaxonomy[],
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("products")
    .select("destination_id")
    .eq("is_active", true)
    .not("destination_id", "is", null);
  if (error) throw new Error(error.message);

  const taxonomyIds = new Set(taxonomies.map((t) => t.id));
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const destinationId = String((row as { destination_id?: string | null }).destination_id ?? "").trim();
    if (!destinationId || !taxonomyIds.has(destinationId)) continue;
    counts.set(destinationId, (counts.get(destinationId) ?? 0) + 1);
  }
  return counts;
}

async function resolveThemeCountsByFk(taxonomies: RawTaxonomy[]): Promise<Map<string, number> | null> {
  const { data, error } = await supabase
    .from("products")
    .select("theme_id")
    .eq("is_active", true)
    .not("theme_id", "is", null);

  if (error) {
    if (isMissingColumnError(error.message)) return null;
    throw new Error(error.message);
  }

  const taxonomyIds = new Set(taxonomies.map((t) => t.id));
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const themeId = String((row as { theme_id?: string | null }).theme_id ?? "").trim();
    if (!themeId || !taxonomyIds.has(themeId)) continue;
    counts.set(themeId, (counts.get(themeId) ?? 0) + 1);
  }
  return counts;
}

async function resolveThemeCountsByLegacyText(taxonomies: RawTaxonomy[]): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("products")
    .select("theme")
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  const lookup = new Map<string, string[]>();
  for (const tax of taxonomies) {
    const keys = [tax.slug ?? "", tax.name ?? ""].map((v) => normalizeSlug(v)).filter(Boolean);
    for (const key of keys) {
      if (!lookup.has(key)) lookup.set(key, []);
      lookup.get(key)!.push(tax.id);
    }
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const rawTheme = typeof (row as { theme?: unknown }).theme === "string" ? String((row as { theme?: string }).theme) : "";
    const tokens = parseThemeTokens(rawTheme);
    for (const token of tokens) {
      const normalizedToken = normalizeSlug(token);
      if (!normalizedToken) continue;
      const matchedTaxonomyIds = lookup.get(normalizedToken) ?? [];
      for (const matchedTaxonomyId of matchedTaxonomyIds) {
        counts.set(matchedTaxonomyId, (counts.get(matchedTaxonomyId) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export async function resolveThemeProductCounts(taxonomies: RawTaxonomy[]): Promise<Map<string, number>> {
  const byFk = await resolveThemeCountsByFk(taxonomies);
  if (byFk) return byFk;
  return resolveThemeCountsByLegacyText(taxonomies);
}

export async function resolveProductLineProductCounts(taxonomies: RawTaxonomy[]): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("products")
    .select("product_line_id")
    .eq("is_active", true)
    .not("product_line_id", "is", null);

  if (error) {
    if (isMissingColumnError(error.message)) return new Map();
    throw new Error(error.message);
  }

  const taxonomyIds = new Set(taxonomies.map((t) => t.id));
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const lineId = String((row as { product_line_id?: string | null }).product_line_id ?? "").trim();
    if (!lineId || !taxonomyIds.has(lineId)) continue;
    counts.set(lineId, (counts.get(lineId) ?? 0) + 1);
  }
  return counts;
}
