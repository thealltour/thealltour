import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateFlyerShareSlug } from "@/lib/flyers/generateFlyerShareSlug";
import {
  buildAdminFlyerUrl,
  coerceFlyerDraftRow,
  flyerDraftStateToDbPayload,
  mapFlyerRowToApi,
  normalizeFlyerTemplateKey,
  parseEditableFields,
  parseFlyerOutfitDraft,
  parseFlyerWeatherDraft,
  parseLayoutOptions,
  parseSectionToggles,
} from "@/lib/flyers/serializeFlyerDraft";
import type { FlyerDraftState, SaveFlyerDraftResponse } from "@/lib/flyers/flyer.types";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function parseBodyToDraftState(
  body: Record<string, unknown>,
): { ok: true; state: FlyerDraftState; productId: string } | { ok: false; message: string } {
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  if (!productId || !isUuid(productId)) {
    return { ok: false, message: "유효한 productId가 필요합니다." };
  }
  const sections = parseSectionToggles(body.sections);
  const fields = parseEditableFields(body.fields);
  const weather =
    body.weather !== undefined
      ? parseFlyerWeatherDraft(body.weather)
      : parseFlyerWeatherDraft(body.fields);
  const outfit =
    body.outfit !== undefined ? parseFlyerOutfitDraft(body.outfit) : parseFlyerOutfitDraft(body.fields);
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((x): x is string => typeof x === "string").map((s) => s.trim())
    : [];
  const state: FlyerDraftState = {
    templateKey: normalizeFlyerTemplateKey(typeof body.templateKey === "string" ? body.templateKey : undefined),
    layoutOptions: parseLayoutOptions(body.layoutOptions),
    sections,
    fields,
    weather,
    outfit,
    selectedImageUrls: imageUrls.slice(0, 4),
  };
  return { ok: true, productId, state };
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  const parsed = parseBodyToDraftState(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  const pid = parsed.productId;

  const { data: prodRow } = await supabaseAdmin.from("products").select("id").eq("id", pid).maybeSingle();
  if (!prodRow) {
    return NextResponse.json({ ok: false, message: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const dbPayload = flyerDraftStateToDbPayload(parsed.state);

  const maxAttempts = 6;
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const share_slug = generateFlyerShareSlug(14);
    const insertRow = {
      product_id: pid,
      template_key: parsed.state.templateKey,
      title: dbPayload.title || null,
      subtitle: dbPayload.subtitle || null,
      layout_options_json: dbPayload.layout_options_json,
      sections_json: dbPayload.sections_json,
      fields_json: dbPayload.fields_json,
      image_urls_json: dbPayload.image_urls_json,
      preview_version: 1,
      png_file_url: null,
      share_slug,
      created_by: null,
    };

    const { data, error } = await supabaseAdmin.from("flyer_drafts").insert(insertRow).select("*").single();

    if (!error && data) {
      const row = coerceFlyerDraftRow(data as Record<string, unknown>);
      if (!row) {
        return NextResponse.json({ ok: false, message: "저장 응답을 해석할 수 없습니다." }, { status: 500 });
      }
      const origin = new URL(request.url).origin;
      const payload: SaveFlyerDraftResponse = {
        ok: true,
        draft: mapFlyerRowToApi(row),
        adminUrl: buildAdminFlyerUrl(origin, row.id),
      };
      return NextResponse.json(payload, { status: 201 });
    }

    const msg = error?.message ?? "";
    lastErr = msg;
    if (msg.includes("duplicate") || msg.includes("23505") || msg.toLowerCase().includes("unique")) {
      continue;
    }
    console.error("[POST /api/admin/flyers]", error);
    return NextResponse.json({ ok: false, message: "유인물 저장에 실패했습니다." }, { status: 500 });
  }

  console.error("[POST /api/admin/flyers] slug retry exhausted", lastErr);
  return NextResponse.json({ ok: false, message: "고유 링크(slug) 생성에 실패했습니다. 다시 시도해 주세요." }, { status: 500 });
}
