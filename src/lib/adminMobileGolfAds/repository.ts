import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  mapMobileGolfAdLandingRow,
  type MobileGolfAdLanding,
  type MobileGolfAdLandingInput,
  type MobileGolfAdLandingListItem,
  type MobileGolfAdLandingRow,
} from "@/lib/adminMobileGolfAds/types";
import { buildLegacyDbFieldsFromInput } from "@/lib/adminMobileGolfAds/validation";

function toDbPayload(input: MobileGolfAdLandingInput) {
  const legacy = buildLegacyDbFieldsFromInput(input);
  return {
    title: input.title,
    slug: input.slug,
    hero_image_url: input.heroImageUrl,
    benefit_text: legacy.benefit_text,
    trust_action_text: legacy.trust_action_text,
    seo_title: input.seoTitle ?? null,
    seo_description: input.seoDescription ?? null,
    style_config: legacy.style_config,
    body_doc: legacy.body_doc,
    updated_at: new Date().toISOString(),
  };
}

export async function listMobileGolfAdLandings(): Promise<MobileGolfAdLandingListItem[]> {
  const { data, error } = await supabaseAdmin
    .from("mobile_golf_ad_landings")
    .select("id, title, slug, is_published, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    isPublished: Boolean(row.is_published),
    updatedAt: String(row.updated_at),
  }));
}

export async function getMobileGolfAdLandingById(id: string): Promise<MobileGolfAdLanding | null> {
  const { data, error } = await supabaseAdmin
    .from("mobile_golf_ad_landings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapMobileGolfAdLandingRow(data as MobileGolfAdLandingRow);
}

export async function getPublishedMobileGolfAdLandingBySlug(
  slug: string,
): Promise<MobileGolfAdLanding | null> {
  const { data, error } = await supabaseAdmin
    .from("mobile_golf_ad_landings")
    .select("*")
    .eq("slug", slug.trim())
    .eq("is_published", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapMobileGolfAdLandingRow(data as MobileGolfAdLandingRow);
}

export async function createMobileGolfAdLanding(
  input: MobileGolfAdLandingInput,
): Promise<MobileGolfAdLanding> {
  const { data, error } = await supabaseAdmin
    .from("mobile_golf_ad_landings")
    .insert({ ...toDbPayload(input), is_published: false })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("이미 사용 중인 slug입니다.");
    throw new Error(error.message);
  }
  return mapMobileGolfAdLandingRow(data as MobileGolfAdLandingRow);
}

export async function updateMobileGolfAdLanding(
  id: string,
  input: MobileGolfAdLandingInput,
): Promise<MobileGolfAdLanding> {
  const { data, error } = await supabaseAdmin
    .from("mobile_golf_ad_landings")
    .update(toDbPayload(input))
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("이미 사용 중인 slug입니다.");
    throw new Error(error.message);
  }
  return mapMobileGolfAdLandingRow(data as MobileGolfAdLandingRow);
}

export async function deleteMobileGolfAdLanding(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("mobile_golf_ad_landings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function publishMobileGolfAdLanding(id: string): Promise<MobileGolfAdLanding> {
  const existing = await getMobileGolfAdLandingById(id);
  if (!existing) throw new Error("랜딩을 찾을 수 없습니다.");

  const { data, error } = await supabaseAdmin
    .from("mobile_golf_ad_landings")
    .update({ is_published: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapMobileGolfAdLandingRow(data as MobileGolfAdLandingRow);
}

export async function unpublishMobileGolfAdLanding(id: string): Promise<MobileGolfAdLanding> {
  const { data, error } = await supabaseAdmin
    .from("mobile_golf_ad_landings")
    .update({ is_published: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("랜딩을 찾을 수 없습니다.");
  return mapMobileGolfAdLandingRow(data as MobileGolfAdLandingRow);
}
