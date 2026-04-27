import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildAdminFlyerUrl,
  coerceFlyerDraftRow,
  flyerDraftStateFromRowParts,
  flyerDraftStateToDbPayload,
  mapFlyerRowToApi,
  mergeLayoutOptions,
  normalizeFlyerTemplateKey,
  parseEditableFields,
  parseFlyerOutfitDraft,
  parseFlyerWeatherDraft,
  parseSectionToggles,
} from "@/lib/flyers/serializeFlyerDraft";
import type { FlyerDraftState } from "@/lib/flyers/flyer.types";
import { FLYER_MAX_GALLERY_IMAGES } from "@/lib/flyers/flyer.types";
import { generateFlyerShareSlug } from "@/lib/flyers/generateFlyerShareSlug";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const rawId = id?.trim();
  if (!rawId || !isUuid(rawId)) {
    return NextResponse.json({ ok: false, message: "유효한 draft id가 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("flyer_drafts").select("*").eq("id", rawId).maybeSingle();

  if (error) {
    console.error("[GET /api/admin/flyers/[id]]", error);
    return NextResponse.json({ ok: false, message: "유인물 조회에 실패했습니다." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, message: "유인물을 찾을 수 없습니다." }, { status: 404 });
  }

  const row = coerceFlyerDraftRow(data as Record<string, unknown>);
  if (!row) {
    return NextResponse.json({ ok: false, message: "데이터 형식이 올바르지 않습니다." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    ok: true,
    draft: mapFlyerRowToApi(row),
    adminUrl: buildAdminFlyerUrl(origin, row.id),
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const rawId = id?.trim();
  if (!rawId || !isUuid(rawId)) {
    return NextResponse.json({ ok: false, message: "유효한 draft id가 필요합니다." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  const { data: existing, error: exErr } = await supabaseAdmin
    .from("flyer_drafts")
    .select("*")
    .eq("id", rawId)
    .maybeSingle();

  if (exErr || !existing) {
    return NextResponse.json({ ok: false, message: "유인물을 찾을 수 없습니다." }, { status: 404 });
  }

  const existingRow = coerceFlyerDraftRow(existing as Record<string, unknown>);
  if (!existingRow) {
    return NextResponse.json({ ok: false, message: "기존 데이터를 읽을 수 없습니다." }, { status: 500 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  /** 레거시 행에 share_slug 없을 때 공개 링크용 slug 부여 */
  if (!existingRow.share_slug) {
    updates.share_slug = generateFlyerShareSlug(14);
  }

  const touchesDraft =
    body.templateKey !== undefined ||
    body.layoutOptions !== undefined ||
    body.sections !== undefined ||
    body.fields !== undefined ||
    body.weather !== undefined ||
    body.outfit !== undefined ||
    body.imageUrls !== undefined;

  if (touchesDraft) {
    const base = flyerDraftStateFromRowParts(
      existingRow.sections_json,
      existingRow.fields_json,
      existingRow.image_urls_json,
      existingRow.template_key,
      existingRow.layout_options_json,
    );
    const next: FlyerDraftState = { ...base };

    if (body.templateKey !== undefined) {
      if (typeof body.templateKey !== "string" || !body.templateKey.trim()) {
        return NextResponse.json({ ok: false, message: "templateKey가 올바르지 않습니다." }, { status: 400 });
      }
      next.templateKey = normalizeFlyerTemplateKey(body.templateKey);
    }
    if (body.layoutOptions !== undefined) {
      next.layoutOptions = mergeLayoutOptions(next.layoutOptions, body.layoutOptions);
    }
    if (body.sections !== undefined) {
      next.sections = parseSectionToggles(body.sections);
    }
    if (body.fields !== undefined) {
      next.fields = parseEditableFields(body.fields);
    }
    if (body.weather !== undefined) {
      next.weather = parseFlyerWeatherDraft(body.weather);
    }
    if (body.outfit !== undefined) {
      next.outfit = parseFlyerOutfitDraft(body.outfit);
    }
    if (body.imageUrls !== undefined) {
      next.selectedImageUrls = Array.isArray(body.imageUrls)
        ? body.imageUrls.filter((x): x is string => typeof x === "string").map((s) => s.trim()).slice(0, FLYER_MAX_GALLERY_IMAGES)
        : [];
    }

    const merged = flyerDraftStateToDbPayload(next);
    updates.template_key = next.templateKey;
    updates.layout_options_json = merged.layout_options_json;
    updates.sections_json = merged.sections_json;
    updates.fields_json = merged.fields_json;
    updates.image_urls_json = merged.image_urls_json;
    updates.title = merged.title || null;
    updates.subtitle = merged.subtitle || null;
  }

  if (body.pngFileUrl !== undefined) {
    if (body.pngFileUrl === null) {
      updates.png_file_url = null;
    } else if (typeof body.pngFileUrl === "string") {
      updates.png_file_url = body.pngFileUrl.trim() || null;
    } else {
      return NextResponse.json({ ok: false, message: "pngFileUrl 형식이 올바르지 않습니다." }, { status: 400 });
    }
  }

  if (body.previewVersion !== undefined) {
    if (typeof body.previewVersion !== "number" || !Number.isFinite(body.previewVersion)) {
      return NextResponse.json({ ok: false, message: "previewVersion이 올바르지 않습니다." }, { status: 400 });
    }
    updates.preview_version = Math.floor(body.previewVersion);
  }

  const { data, error } = await supabaseAdmin.from("flyer_drafts").update(updates).eq("id", rawId).select("*").single();

  if (error || !data) {
    console.error("[PATCH /api/admin/flyers/[id]]", error);
    return NextResponse.json({ ok: false, message: "유인물 업데이트에 실패했습니다." }, { status: 500 });
  }

  const row = coerceFlyerDraftRow(data as Record<string, unknown>);
  if (!row) {
    return NextResponse.json({ ok: false, message: "저장 응답을 해석할 수 없습니다." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    ok: true,
    draft: mapFlyerRowToApi(row),
    adminUrl: buildAdminFlyerUrl(origin, row.id),
  });
}
