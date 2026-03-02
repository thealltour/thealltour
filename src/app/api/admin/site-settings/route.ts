import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { SiteSettings } from "@/lib/siteSettings";

type SiteSettingsBody = Partial<SiteSettings>;

export async function GET() {
  const { data, error } = await supabase.from("site_settings").select("key, value");

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
  const body = (await request.json()) as SiteSettingsBody;
  const entries: { key: keyof SiteSettings; value: string }[] = [
    { key: "kakao_channel_url", value: (body.kakao_channel_url ?? "").trim() },
    { key: "instagram_url", value: (body.instagram_url ?? "").trim() },
    { key: "kakao_chat_url", value: (body.kakao_chat_url ?? "").trim() },
    { key: "products_hero_headline", value: (body.products_hero_headline ?? "").trim() },
    { key: "products_hero_subcopy", value: (body.products_hero_subcopy ?? "").trim() },
    { key: "products_hero_regions", value: (body.products_hero_regions ?? "").trim() },
    { key: "golf_hero_headline", value: (body.golf_hero_headline ?? "").trim() },
    { key: "golf_hero_subcopy", value: (body.golf_hero_subcopy ?? "").trim() },
    { key: "golf_hero_regions", value: (body.golf_hero_regions ?? "").trim() },
    { key: "company_name", value: (body.company_name ?? "").trim() },
    { key: "ceo_name", value: (body.ceo_name ?? "").trim() },
    { key: "address", value: (body.address ?? "").trim() },
    { key: "business_reg_no", value: (body.business_reg_no ?? "").trim() },
    { key: "tourism_reg_no", value: (body.tourism_reg_no ?? "").trim() },
    { key: "mail_order_reg_no", value: (body.mail_order_reg_no ?? "").trim() },
    { key: "main_phone", value: (body.main_phone ?? "").trim() },
    { key: "main_email", value: (body.main_email ?? "").trim() },
    { key: "about_kicker", value: (body.about_kicker ?? "").trim() },
    { key: "about_title", value: (body.about_title ?? "").trim() },
    { key: "about_paragraph1", value: (body.about_paragraph1 ?? "").trim() },
    { key: "about_paragraph2", value: (body.about_paragraph2 ?? "").trim() },
    { key: "about_cta_label", value: (body.about_cta_label ?? "").trim() },
    { key: "about_cta_href", value: (body.about_cta_href ?? "").trim() },
  ];

  for (const entry of entries) {
    const upsertResult = await supabase
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

