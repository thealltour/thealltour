import { supabase } from "@/lib/supabase";

/** `product_taxonomies.id`(campaign) → `name` (상품 `campaigns` 배열과 동일 문자열) */
export async function resolveCampaignTaxonomyNamesByIds(ids: string[]): Promise<string[]> {
  const uniq = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniq.length === 0) return [];

  const { data, error } = await supabase
    .from("product_taxonomies")
    .select("name")
    .in("id", uniq)
    .eq("taxonomy_type", "campaign");

  if (error || !data?.length) return [];

  return data
    .map((row) => (typeof row.name === "string" ? row.name.trim() : ""))
    .filter(Boolean);
}
