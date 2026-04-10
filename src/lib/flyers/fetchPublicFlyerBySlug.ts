import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { flyerDraftStateFromRowParts } from "@/lib/flyers/serializeFlyerDraft";
import { isValidPublicFlyerSlug } from "@/lib/flyers/publicFlyer";
import type { FlyerDraftState } from "@/lib/flyers/flyer.types";

export type PublicFlyerSlugFetchResult = {
  draft: FlyerDraftState;
  /** 페이지·OG 제목 (DB `title` 우선) */
  displayTitle: string;
  /** DB `subtitle` (있으면) */
  rowSubtitle: string | null;
};

type FlyerDraftRowSlice = {
  sections_json: unknown;
  fields_json: unknown;
  image_urls_json: unknown;
  title: string | null;
  subtitle: string | null;
  share_slug: string | null;
  template_key: string | null;
  layout_options_json: unknown;
};

/**
 * 공개 유인물 `/api/public/flyers/[slug]` · OG 이미지 등 서버에서 동일 스키마로 로드.
 */
export async function fetchPublicFlyerBySlug(slug: string): Promise<PublicFlyerSlugFetchResult | null> {
  const s = slug?.trim() ?? "";
  if (!isValidPublicFlyerSlug(s)) return null;

  const { data, error } = await supabaseAdmin
    .from("flyer_drafts")
    .select(
      "sections_json, fields_json, image_urls_json, title, subtitle, share_slug, template_key, layout_options_json",
    )
    .eq("share_slug", s)
    .maybeSingle();

  if (error) {
    console.error("[fetchPublicFlyerBySlug]", error);
    throw new Error("flyer_fetch_failed");
  }
  if (!data) return null;

  const row = data as FlyerDraftRowSlice;
  if (!row.share_slug || row.share_slug !== s) return null;

  const draft = flyerDraftStateFromRowParts(
    row.sections_json,
    row.fields_json,
    row.image_urls_json,
    row.template_key,
    row.layout_options_json,
  );

  const displayTitle =
    (typeof row.title === "string" && row.title.trim()) ||
    draft.fields.title?.trim() ||
    "여행 유인물";

  return {
    draft,
    displayTitle,
    rowSubtitle: typeof row.subtitle === "string" ? row.subtitle : null,
  };
}
