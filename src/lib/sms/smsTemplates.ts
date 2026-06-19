import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SmsTemplate = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  variables: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SmsTemplateContext = {
  name?: string;
  phone?: string;
  product_title?: string;
};

function mapRow(row: Record<string, unknown>): SmsTemplate {
  const vars = row.variables;
  return {
    id: String(row.id ?? ""),
    title: typeof row.title === "string" ? row.title : "",
    body: typeof row.body === "string" ? row.body : "",
    category: typeof row.category === "string" ? row.category : null,
    variables: Array.isArray(vars) ? vars.map(String) : [],
    is_active: row.is_active !== false,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

export function applySmsTemplate(body: string, context: SmsTemplateContext): string {
  let out = body;
  const map: Record<string, string> = {
    name: context.name?.trim() || "고객",
    phone: context.phone?.trim() || "",
    product_title: context.product_title?.trim() || "",
  };
  for (const [key, value] of Object.entries(map)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

export async function listSmsTemplates(activeOnly = true): Promise<SmsTemplate[]> {
  let query = supabaseAdmin
    .from("sms_templates")
    .select("id, title, body, category, variables, is_active, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    console.error("[listSmsTemplates] query failed", error);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getSmsTemplateByCategory(category: string): Promise<SmsTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from("sms_templates")
    .select("id, title, body, category, variables, is_active, sort_order, created_at, updated_at")
    .eq("category", category)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function getSmsTemplateById(id: string): Promise<SmsTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from("sms_templates")
    .select("id, title, body, category, variables, is_active, sort_order, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}
