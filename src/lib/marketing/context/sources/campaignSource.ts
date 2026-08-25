import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AiCampaignNameRow = {
  id?: unknown;
  name?: unknown;
};

export async function fetchAiCampaignNameRowsByIds(ids: string[]): Promise<AiCampaignNameRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin.from("ai_campaigns").select("id, name").in("id", ids);
  if (error) throw new Error(`ai_campaigns lookup failed: ${error.message}`);
  return (data as AiCampaignNameRow[] | null) ?? [];
}
