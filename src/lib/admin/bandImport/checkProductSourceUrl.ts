import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function findExistingProductIdBySourceUrl(
  productSourceUrl: string,
): Promise<string | null> {
  const url = productSourceUrl.trim();
  if (!url) return null;

  const { data } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("product_source_url", url)
    .limit(1)
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}
