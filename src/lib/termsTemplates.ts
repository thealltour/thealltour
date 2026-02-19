import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

export const TERMS_TEMPLATE_TYPES = [
  "overseas_brokerage",
  "domestic_brokerage",
  "overseas_direct",
  "domestic_direct",
] as const;

export type TermsTemplateType = (typeof TERMS_TEMPLATE_TYPES)[number];

type TermsTemplateRow = {
  type: string;
  content: string | null;
};

export type TermsTemplateMap = Record<TermsTemplateType, string>;

function emptyTemplateMap(): TermsTemplateMap {
  return {
    overseas_brokerage: "",
    domestic_brokerage: "",
    overseas_direct: "",
    domestic_direct: "",
  };
}

export const getTermsTemplateMap = unstable_cache(
  async (): Promise<TermsTemplateMap> => {
    const { data, error } = await supabase.from("product_terms_templates").select("type,content");
    if (error || !data) {
      return emptyTemplateMap();
    }

    const map = emptyTemplateMap();
    for (const row of data as TermsTemplateRow[]) {
      if ((TERMS_TEMPLATE_TYPES as readonly string[]).includes(row.type)) {
        map[row.type as TermsTemplateType] = row.content ?? "";
      }
    }
    return map;
  },
  ["product-terms-templates"],
  { revalidate: 60, tags: ["products"] },
);

export async function getTermsTemplateContent(type?: string) {
  if (!type || !(TERMS_TEMPLATE_TYPES as readonly string[]).includes(type)) return "";
  const map = await getTermsTemplateMap();
  return map[type as TermsTemplateType] ?? "";
}
