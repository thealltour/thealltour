import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdminSession } from "@/lib/apiAuth";
import type { SiteSettings } from "@/lib/siteSettings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SiteSettingsBody = Partial<SiteSettings>;

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { data, error } = await supabaseAdmin.from("site_settings").select("key, value");

  if (error) {
    return NextResponse.json({ message: "환경설정 조회에 실패했습니다." }, { status: 500 });
  }

  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!row || !row.key) continue;
    result[row.key] = row.value ?? "";
  }

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as SiteSettingsBody;
  type SiteSettingsKey = keyof SiteSettings;

  const ALL_KEYS: { key: SiteSettingsKey; defaultValue: string }[] = [
    { key: "kakao_channel_url", defaultValue: "" },
    { key: "instagram_url", defaultValue: "" },
    { key: "naver_band_url", defaultValue: "" },
    { key: "naver_blog_url", defaultValue: "" },
    { key: "kakao_chat_url", defaultValue: "" },
    { key: "products_hero_headline", defaultValue: "" },
    { key: "products_hero_subcopy", defaultValue: "" },
    { key: "products_hero_regions", defaultValue: "" },
    { key: "golf_hero_headline", defaultValue: "" },
    { key: "golf_hero_subcopy", defaultValue: "" },
    { key: "golf_hero_regions", defaultValue: "" },
    { key: "home_region_card_ids", defaultValue: "[]" },
    { key: "home_region_section_eyebrow", defaultValue: "" },
    { key: "home_region_section_title", defaultValue: "" },
    { key: "home_region_section_description", defaultValue: "" },
    { key: "home_theme_card_ids", defaultValue: "[]" },
    { key: "home_theme_section_eyebrow", defaultValue: "" },
    { key: "home_theme_section_title", defaultValue: "" },
    { key: "home_theme_section_description", defaultValue: "" },
    { key: "home_golf_tour_product_ids", defaultValue: "[]" },
    { key: "home_golf_tour_section_eyebrow", defaultValue: "" },
    { key: "home_golf_tour_section_title", defaultValue: "" },
    { key: "home_golf_tour_section_description", defaultValue: "" },
    { key: "products_collection_recommend_campaign_ids", defaultValue: "[]" },
    { key: "products_collection_popular_campaign_ids", defaultValue: "[]" },
    { key: "company_name", defaultValue: "" },
    { key: "ceo_name", defaultValue: "" },
    { key: "address", defaultValue: "" },
    { key: "business_reg_no", defaultValue: "" },
    { key: "tourism_reg_no", defaultValue: "" },
    { key: "mail_order_reg_no", defaultValue: "" },
    { key: "main_phone", defaultValue: "" },
    { key: "main_email", defaultValue: "" },
    { key: "about_kicker", defaultValue: "" },
    { key: "about_title", defaultValue: "" },
    { key: "about_paragraph1", defaultValue: "" },
    { key: "about_paragraph2", defaultValue: "" },
    { key: "about_cta_label", defaultValue: "" },
    { key: "about_cta_href", defaultValue: "" },
    { key: "deposit_amount_default", defaultValue: "" },
    { key: "deposit_bank_name", defaultValue: "" },
    { key: "deposit_bank_account", defaultValue: "" },
    { key: "deposit_account_holder", defaultValue: "" },
    { key: "deposit_payment_links", defaultValue: "[]" },
    { key: "thread_reply_destinations", defaultValue: "[]" },
    { key: "consult_sla_minutes", defaultValue: "30" },
  ];

  const entries: { key: SiteSettingsKey; value: string }[] = [];
  for (const { key, defaultValue } of ALL_KEYS) {
    if (!(key in body)) continue;
    const raw = body[key];
    const value =
      typeof raw === "string"
        ? raw.trim()
        : raw === undefined || raw === null
          ? defaultValue
          : String(raw).trim();
    entries.push({ key, value });
  }

  for (const entry of entries) {
    const upsertResult = await supabaseAdmin
      .from("site_settings")
      .upsert(
        { key: entry.key, value: entry.value },
        {
          onConflict: "key",
        },
      );

    if (upsertResult.error) {
      return NextResponse.json({ message: "환경설정 저장에 실패했습니다." }, { status: 500 });
    }
  }

  revalidateTag("site-settings", "max");
  return NextResponse.json({ message: "환경설정을 저장했습니다." });
}

