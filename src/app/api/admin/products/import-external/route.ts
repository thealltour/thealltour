import { NextRequest } from "next/server";

import { revalidateTag, revalidatePath } from "next/cache";

import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";

import { requireAdminSession } from "@/lib/apiAuth";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { findExistingProductIdBySourceUrl } from "@/lib/admin/bandImport/checkProductSourceUrl";

import {

  buildExternalImportCorsHeaders,

  externalImportOptionsResponse,

  withExternalImportCors,

} from "@/lib/admin/externalImport/cors";

import {

  detectExternalProvider,

  getExternalProviderLabel,

  logExternalProvider,

} from "@/lib/admin/externalImport/detectExternalProvider";

import { normalizeItineraryBlocks } from "@/lib/admin/externalImport/itineraryBlockTypes";

import { hasImportAiKey, MISSING_IMPORT_AI_KEY_MESSAGE } from "@/lib/admin/ai/importAiModel";

import { parseExternalProductPage, formatExternalParseError } from "@/lib/admin/externalImport/parseExternalProductPage";

import { mergeExternalImport } from "@/lib/admin/externalImport/mergeExternalImport";

import {

  mapExternalParsedToInsert,

  summarizeExternalParsedForResponse,

} from "@/lib/admin/externalImport/mapExternalParsedToInsert";

import { normalizeHanatourCalendarPayload } from "@/lib/admin/externalImport/hanatour/types";

import { insertProductWithSchemaFallback } from "@/lib/supabaseProductsColumnFallback";



function normalizeUrlList(raw: unknown): string[] {

  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();

  const out: string[] = [];

  for (const item of raw) {

    if (typeof item !== "string") continue;

    const trimmed = item.trim();

    if (!trimmed || seen.has(trimmed)) continue;

    seen.add(trimmed);

    out.push(trimmed);

  }

  return out;

}



type ImportExternalBody = {
  cleanHtmlStructure?: string;
  productGalleryUrls?: string[];
  heroImageUrl?: string;
  sourceProductTitle?: string;
  seoHashtags?: string[];
  product_source_url?: string;
  /** @deprecated 관리자 수동 폼용 */
  rawHtmlText?: string;
  itineraryBlocks?: unknown[];
  hanatourCalendarPayload?: unknown;
};



export async function OPTIONS(request: NextRequest) {

  return externalImportOptionsResponse(request);

}



export async function POST(request: NextRequest) {

  const corsOnly = (body: Record<string, unknown>, status: number) =>

    withExternalImportCors(request, body, { status });



  const auth = await requireAdminSession();

  if (!auth.ok) {

    return new Response(auth.res.body, {

      status: auth.res.status,

      headers: {

        ...Object.fromEntries(auth.res.headers.entries()),

        ...buildExternalImportCorsHeaders(request),

      },

    });

  }



  let body: ImportExternalBody;

  try {

    body = (await request.json()) as ImportExternalBody;

  } catch {

    return corsOnly({ message: "요청 본문이 올바르지 않습니다." }, 400);

  }



  const cleanHtmlStructure = body.cleanHtmlStructure?.trim() ?? "";
  const rawHtmlText = body.rawHtmlText?.trim() ?? "";

  if (!cleanHtmlStructure && !rawHtmlText) {
    return corsOnly(
      { message: "페이지 HTML(cleanHtmlStructure) 또는 텍스트(rawHtmlText)가 비어 있습니다." },
      400,
    );
  }



  const productSourceUrl = body.product_source_url?.trim() ?? "";

  if (productSourceUrl) {

    const existingId = await findExistingProductIdBySourceUrl(productSourceUrl);

    if (existingId) {

      return corsOnly(

        {

          message: "이미 같은 원본 URL로 생성된 상품이 있습니다.",

          existingId,

        },

        409,

      );

    }

  }



  const provider = productSourceUrl ? logExternalProvider(productSourceUrl) : null;

  if (productSourceUrl && !detectExternalProvider(productSourceUrl)) {

    console.warn(`[import-external] unrecognized provider url=${productSourceUrl}`);

  }



  if (!hasImportAiKey()) {

    return corsOnly({ message: MISSING_IMPORT_AI_KEY_MESSAGE }, 500);

  }



  const itineraryBlocks = normalizeItineraryBlocks(body.itineraryBlocks);

  const productGalleryUrls = normalizeUrlList(body.productGalleryUrls);

  const heroImageUrl = body.heroImageUrl?.trim() || null;

  const sourceProductTitle = body.sourceProductTitle?.trim() || null;

  const seoHashtags = normalizeUrlList(body.seoHashtags);

  const hanatourCalendarPayload = normalizeHanatourCalendarPayload(body.hanatourCalendarPayload);



  let metaResult;

  try {

    metaResult = await parseExternalProductPage({
      cleanHtmlStructure: cleanHtmlStructure || undefined,
      rawHtmlText: rawHtmlText || undefined,
      itineraryBlocks: itineraryBlocks.length > 0 ? itineraryBlocks : undefined,
      productSourceUrl,
      provider,
    });

  } catch (error) {

    console.error("[import-external] AI parse failed:", error);

    return corsOnly({ message: formatExternalParseError(error) }, 500);

  }



  const parsed = mergeExternalImport({

    meta: metaResult.meta,

    productGalleryUrls: productGalleryUrls.length > 0 ? productGalleryUrls : undefined,

    heroImageUrl,

    sourceProductTitle,

    seoHashtags: seoHashtags.length > 0 ? seoHashtags : undefined,

    itineraryBlocks,

    aiItineraryFallback: metaResult.aiItineraryFallback,

    theme_chart_json: metaResult.theme_chart_json,

  });



  const insertPayload = mapExternalParsedToInsert({

    parsed,

    productSourceUrl: productSourceUrl || null,

    provider,

    sourceProductTitle,

    seoHashtags: seoHashtags.length > 0 ? seoHashtags : undefined,

    hanatourCalendarPayload,

  });

  const parsedSummary = summarizeExternalParsedForResponse(parsed, { hanatourCalendarPayload });
  if (provider === "hanatour" && parsedSummary.departureScheduleCount === 0) {
    console.warn(
      "[import-external] hanatour calendar empty",
      JSON.stringify({
        saleProdCd: hanatourCalendarPayload?.saleProdCd ?? null,
        rprsProdCd: hanatourCalendarPayload?.rprsProdCd ?? null,
        monthKeys: hanatourCalendarPayload?.searchCalendar
          ? Object.keys(hanatourCalendarPayload.searchCalendar)
          : [],
        fetchMeta: hanatourCalendarPayload?.fetchMeta ?? null,
      }),
    );
  }



  const insertResult = await insertProductWithSchemaFallback(
    async (payload) =>
      await supabaseAdmin.from("products").insert(payload).select("id").maybeSingle(),
    insertPayload as Record<string, unknown>,
  );

  if (insertResult.strippedColumns.length > 0) {
    console.warn(
      "[import-external] stripped missing columns (apply migration 20260627100000):",
      insertResult.strippedColumns.join(", "),
    );
  }

  if (insertResult.error) {
    console.error("[import-external] insert failed:", insertResult.error);

    return corsOnly(

      { message: `상품 등록에 실패했습니다. (${insertResult.error.message})` },

      500,

    );

  }



  if (!insertResult.data?.id) {

    return corsOnly(

      { message: "상품 등록 권한이 없습니다. (RLS 정책 확인 필요)" },

      403,

    );

  }



  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);

  revalidatePath("/products");



  return corsOnly(

    {

      id: insertResult.data.id,

      message: "외부 상품이 등록되었습니다.",

      provider: getExternalProviderLabel(provider),

      parsed: parsedSummary,

    },

    201,

  );

}


