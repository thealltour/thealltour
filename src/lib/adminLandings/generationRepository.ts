import { supabase } from "@/lib/supabase";
import {
  resolveDestinationProductCounts,
  resolveThemeProductCounts,
} from "@/lib/adminLandings/taxonomyCandidateResolver";
import type {
  LandingGenerationCandidate,
  LandingGenerationRequestItem,
} from "@/types/adminLanding";

type TaxonomyType = "destination" | "theme";

type CandidateFilter = {
  taxonomyType?: "all" | TaxonomyType;
  alreadyGenerated?: boolean | null;
};

type RawTaxonomy = {
  id: string;
  taxonomy_type: TaxonomyType;
  name: string;
  slug: string | null;
  is_active: boolean;
};

type ExistingLanding = {
  id: string;
  slug: string | null;
  template_type: string | null;
  quote_category: string | null;
  source_path: string | null;
  source_taxonomy_id: string | null;
  source_taxonomy_type: string | null;
  source_taxonomy_slug: string | null;
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

function buildSuggested(baseSlug: string, taxonomyName: string, taxonomyType: TaxonomyType) {
  const name = taxonomyName.trim();
  const root = baseSlug.trim() ? normalizeSlug(baseSlug) : normalizeSlug(name);
  const slug = root.endsWith("-travel") ? root : `${root}-travel`;
  const templateType =
    taxonomyType === "destination" ? "destination_consulting" : "theme_consulting";
  const title = `${name} 여행 상담`;
  return {
    title,
    slug,
    templateType: templateType as "destination_consulting" | "theme_consulting",
    quoteCategory: root || null,
  };
}

function matchExistingLanding(
  existing: ExistingLanding[],
  taxonomy: RawTaxonomy,
  suggestedSlug: string,
): ExistingLanding | null {
  const taxonomyId = taxonomy.id;
  const taxonomyType = taxonomy.taxonomy_type;
  const taxonomySlug = normalizeSlug(taxonomy.slug ?? taxonomy.name);
  for (const row of existing) {
    const sourceId = row.source_taxonomy_id?.trim();
    const sourceType = row.source_taxonomy_type?.trim();
    const sourceSlug = row.source_taxonomy_slug?.trim();
    if (sourceId && sourceType && sourceId === taxonomyId && sourceType === taxonomyType) return row;
    if (sourceSlug && sourceType && normalizeSlug(sourceSlug) === taxonomySlug && sourceType === taxonomyType) return row;
    if (row.slug && normalizeSlug(row.slug) === suggestedSlug) return row;
  }
  return null;
}

export async function listLandingGenerationCandidates(
  filter: CandidateFilter = {},
): Promise<LandingGenerationCandidate[]> {
  const targetType = filter.taxonomyType ?? "all";

  const { data: taxRows, error: taxErr } = await supabase
    .from("product_taxonomies")
    .select("id, taxonomy_type, name, slug, is_active")
    .in("taxonomy_type", ["destination", "theme"])
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (taxErr) throw new Error(taxErr.message);

  const taxonomies = (taxRows ?? []) as RawTaxonomy[];
  const destinationTax = taxonomies.filter(
    (t) => t.taxonomy_type === "destination" && t.name.trim().length > 0,
  );
  const themeTax = taxonomies.filter((t) => t.taxonomy_type === "theme");
  const themeActiveTax = themeTax.filter((t) => t.name.trim().length > 0);

  const [destinationCount, themeCount] = await Promise.all([
    resolveDestinationProductCounts(destinationTax),
    resolveThemeProductCounts(themeActiveTax),
  ]);

  const { data: existingRows, error: existingErr } = await supabase
    .from("home_curated_sections")
    .select("*");
  if (existingErr) throw new Error(existingErr.message);
  const existing = (existingRows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      slug: typeof r.slug === "string" ? r.slug : null,
      template_type: typeof r.template_type === "string" ? r.template_type : null,
      quote_category: typeof r.quote_category === "string" ? r.quote_category : null,
      source_path: typeof r.source_path === "string" ? r.source_path : null,
      source_taxonomy_id: typeof r.source_taxonomy_id === "string" ? r.source_taxonomy_id : null,
      source_taxonomy_type: typeof r.source_taxonomy_type === "string" ? r.source_taxonomy_type : null,
      source_taxonomy_slug: typeof r.source_taxonomy_slug === "string" ? r.source_taxonomy_slug : null,
    } as ExistingLanding;
  }).filter((row) => {
    if (!row.slug) return false;
    if (
      row.template_type === "destination_consulting" ||
      row.template_type === "theme_consulting" ||
      row.template_type === "recommended_collection" ||
      row.template_type === "custom"
    ) {
      return true;
    }
    return row.source_taxonomy_id != null || row.source_taxonomy_slug != null;
  });

  const candidates: LandingGenerationCandidate[] = [];
  for (const tax of taxonomies) {
    if (targetType !== "all" && tax.taxonomy_type !== targetType) continue;
    if (!tax.name?.trim()) continue;
    const productCount =
      tax.taxonomy_type === "destination"
        ? (destinationCount.get(tax.id) ?? 0)
        : (themeCount.get(tax.id) ?? 0);
    if (productCount <= 0) continue;

    const suggested = buildSuggested(tax.slug ?? "", tax.name, tax.taxonomy_type);
    const matched = matchExistingLanding(existing, tax, suggested.slug);
    const item: LandingGenerationCandidate = {
      taxonomyId: tax.id,
      taxonomyType: tax.taxonomy_type,
      taxonomyName: tax.name,
      taxonomySlug: normalizeSlug(tax.slug ?? tax.name),
      productCount,
      suggestedTitle: suggested.title,
      suggestedSlug: suggested.slug,
      suggestedTemplateType: suggested.templateType,
      suggestedQuoteCategory: suggested.quoteCategory,
      existingLandingId: matched?.id ?? null,
      existingLandingSlug: matched?.slug ?? null,
      isAlreadyGenerated: Boolean(matched),
    };
    candidates.push(item);
  }

  const alreadyGeneratedFilter = filter.alreadyGenerated;
  const filtered =
    alreadyGeneratedFilter == null
      ? candidates
      : candidates.filter((c) => c.isAlreadyGenerated === alreadyGeneratedFilter);

  return filtered.sort((a, b) => {
    if (a.isAlreadyGenerated !== b.isAlreadyGenerated) return a.isAlreadyGenerated ? 1 : -1;
    if (a.taxonomyType !== b.taxonomyType) return a.taxonomyType.localeCompare(b.taxonomyType);
    if (b.productCount !== a.productCount) return b.productCount - a.productCount;
    return a.taxonomyName.localeCompare(b.taxonomyName, "ko");
  });
}

export function toCandidateKey(item: LandingGenerationRequestItem): string {
  return `${item.taxonomyType}:${item.taxonomyId}`;
}
