import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findExistingProductIdBySourceUrl } from "@/lib/admin/bandImport/checkProductSourceUrl";
import { hasImportAiKey, MISSING_IMPORT_AI_KEY_MESSAGE } from "@/lib/admin/ai/importAiModel";
import { parseBandProductText, formatBandParseError } from "@/lib/admin/bandImport/parseBandProductText";
import {
  mapBandParsedToInsert,
  summarizeBandParsedForResponse,
} from "@/lib/admin/bandImport/mapBandParsedToInsert";
import { insertProductWithSchemaFallback } from "@/lib/supabaseProductsColumnFallback";
import {
  HwpParseError,
  MAX_HWP_FILE_BYTES,
  parseHwpFileToText,
} from "@/lib/admin/bandImport/hwpParser";

type ImportBandBody = {
  bandText?: string;
  hwpText?: string;
  product_source_url?: string;
  imageUrls?: string[];
};

function parseImageUrlsField(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
  }
  if (typeof raw !== "string" || !raw.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim());
      }
    } catch {
      // fall through to newline split
    }
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function pickHwpFile(formData: FormData): File | null {
  const entry = formData.get("hwpFile") ?? formData.get("file");
  if (entry instanceof File && entry.size > 0) return entry;
  return null;
}

async function readImportRequest(request: NextRequest): Promise<{
  bandText: string;
  hwpText: string;
  productSourceUrl: string;
  imageUrls: string[];
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const bandText = formString(formData, "bandText").trim();
    const pastedHwpText = formString(formData, "hwpText").trim();
    const productSourceUrl = formString(formData, "product_source_url").trim();
    const imageUrls = parseImageUrlsField(formString(formData, "imageUrls"));
    const hwpFile = pickHwpFile(formData);

    let hwpText = pastedHwpText;
    if (hwpFile) {
      if (hwpFile.size > MAX_HWP_FILE_BYTES) {
        throw new HwpParseError("HWP 파일은 20MB 이하만 업로드할 수 있습니다.");
      }
      hwpText = await parseHwpFileToText(hwpFile, hwpFile.name || "upload.hwpx");
    }

    return { bandText, hwpText, productSourceUrl, imageUrls };
  }

  let body: ImportBandBody;
  try {
    body = (await request.json()) as ImportBandBody;
  } catch {
    throw new HwpParseError("요청 본문이 올바르지 않습니다.");
  }

  return {
    bandText: body.bandText?.trim() ?? "",
    hwpText: body.hwpText?.trim() ?? "",
    productSourceUrl: body.product_source_url?.trim() ?? "",
    imageUrls: parseImageUrlsField(body.imageUrls),
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let bandText = "";
  let hwpText = "";
  let productSourceUrl = "";
  let imageUrls: string[] = [];

  try {
    const parsedBody = await readImportRequest(request);
    bandText = parsedBody.bandText;
    hwpText = parsedBody.hwpText;
    productSourceUrl = parsedBody.productSourceUrl;
    imageUrls = parsedBody.imageUrls;
  } catch (error) {
    if (error instanceof HwpParseError) {
      return NextResponse.json({ message: error.message }, { status: error.httpStatus });
    }
    const message = error instanceof Error ? error.message : "요청 본문이 올바르지 않습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }

  if (!bandText && !hwpText) {
    return NextResponse.json(
      { message: "밴드 본문 또는 HWP 파일(.hwp/.hwpx) 중 하나 이상을 입력해 주세요." },
      { status: 400 },
    );
  }

  if (productSourceUrl) {
    const existingId = await findExistingProductIdBySourceUrl(productSourceUrl);
    if (existingId) {
      return NextResponse.json(
        {
          message: "이미 같은 원본 URL로 생성된 상품이 있습니다.",
          existingId,
        },
        { status: 409 },
      );
    }
  }

  if (!hasImportAiKey()) {
    return NextResponse.json({ message: MISSING_IMPORT_AI_KEY_MESSAGE }, { status: 500 });
  }

  let parsed;
  try {
    parsed = await parseBandProductText({ bandText, hwpText });
  } catch (error) {
    console.error("[import-band] AI parse failed:", error);
    return NextResponse.json({ message: formatBandParseError(error) }, { status: 500 });
  }

  const insertPayload = mapBandParsedToInsert({
    parsed,
    bandText,
    hwpText,
    productSourceUrl: productSourceUrl || null,
    imageUrls,
  });

  const insertResult = await insertProductWithSchemaFallback(
    async (payload) =>
      await supabaseAdmin.from("products").insert(payload).select("id").maybeSingle(),
    insertPayload as Record<string, unknown>,
  );

  if (insertResult.strippedColumns.length > 0) {
    console.warn("[import-band] stripped missing columns:", insertResult.strippedColumns.join(", "));
  }

  if (insertResult.error) {
    console.error("[import-band] insert failed:", insertResult.error);
    return NextResponse.json(
      { message: `상품 등록에 실패했습니다. (${insertResult.error.message})` },
      { status: 500 },
    );
  }

  if (!insertResult.data?.id) {
    return NextResponse.json(
      { message: "상품 등록 권한이 없습니다. (RLS 정책 확인 필요)" },
      { status: 403 },
    );
  }

  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  revalidatePath("/products");

  return NextResponse.json(
    {
      id: insertResult.data.id,
      message: "밴드 상품이 등록되었습니다.",
      parsed: summarizeBandParsedForResponse(parsed),
    },
    { status: 201 },
  );
}
