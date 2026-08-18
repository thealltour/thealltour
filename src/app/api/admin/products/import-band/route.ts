import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { requireAdminSessionForPath } from "@/lib/apiAuth";
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
import { BandImportImageError } from "@/lib/admin/bandImport/extractBandImportImages";
import {
  filesToBandImportSources,
  processBandImportImages,
  stagingPathsToBandImportSources,
} from "@/lib/admin/bandImport/processBandImportImages";
import { deleteBandImportStagingFiles } from "@/lib/admin/bandImport/bandImportStaging";
import type { ItineraryV2 } from "@/types/product";

export const maxDuration = 300;

type StagingImageRef = { path: string; filename?: string };

type ImportBandBody = {
  bandText?: string;
  hwpText?: string;
  golfCourseInfo?: string;
  golfCoursesJson?: Array<{ name: string; content: string }>;
  product_source_url?: string;
};

function normalizeGolfCoursesInput(raw: unknown): Array<{ name: string; content: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      content: typeof item.content === "string" ? item.content.trim() : "",
    }))
    .filter((item) => item.name.length > 0 && item.content.length > 0);
}

function parseGolfCoursesJsonString(raw: string): Array<{ name: string; content: string }> {
  if (!raw.trim()) return [];
  try {
    return normalizeGolfCoursesInput(JSON.parse(raw));
  } catch {
    return [];
  }
}

function parseStagingImagePaths(raw: string): Array<{ path: string; filename?: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Array<{ path: string; filename?: string }> = [];
    for (const item of parsed) {
      if (typeof item === "string" && item.length > 0) {
        out.push({ path: item });
        continue;
      }
      if (item && typeof item === "object" && typeof item.path === "string" && item.path.length > 0) {
        out.push({
          path: item.path,
          filename: typeof item.filename === "string" ? item.filename : undefined,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
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

function pickImageFiles(formData: FormData): File[] {
  return [...formData.getAll("images"), ...formData.getAll("imageFiles")].filter(
    (entry): entry is File => entry instanceof File && entry.size > 0,
  );
}

async function readImportRequest(request: NextRequest): Promise<{
  bandText: string;
  hwpText: string;
  golfCourseInfo: string;
  golfCoursesJson: Array<{ name: string; content: string }>;
  productSourceUrl: string;
  imageFiles: File[];
  stagingImagePaths: StagingImageRef[];
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new HwpParseError(
        "업로드 파일을 읽지 못했습니다. zip이 크면 10MB 단위로 나눠 올리거나, 개발 서버를 재시작한 뒤 다시 시도해 주세요.",
      );
    }
    const bandText = formString(formData, "bandText").trim();
    const pastedHwpText = formString(formData, "hwpText").trim();
    const golfCourseInfo = formString(formData, "golfCourseInfo").trim();
    const golfCoursesJson = parseGolfCoursesJsonString(formString(formData, "golfCoursesJson"));
    const productSourceUrl = formString(formData, "product_source_url").trim();
    const imageFiles = pickImageFiles(formData);
    const stagingImagePaths = parseStagingImagePaths(formString(formData, "stagingImagePaths"));
    const hwpFile = pickHwpFile(formData);

    let hwpText = pastedHwpText;
    if (hwpFile) {
      if (hwpFile.size > MAX_HWP_FILE_BYTES) {
        throw new HwpParseError("HWP 파일은 20MB 이하만 업로드할 수 있습니다.");
      }
      hwpText = await parseHwpFileToText(hwpFile, hwpFile.name || "upload.hwpx");
    }

    return {
      bandText,
      hwpText,
      golfCourseInfo,
      golfCoursesJson,
      productSourceUrl,
      imageFiles,
      stagingImagePaths,
    };
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
    golfCourseInfo: body.golfCourseInfo?.trim() ?? "",
    golfCoursesJson: normalizeGolfCoursesInput(body.golfCoursesJson),
    productSourceUrl: body.product_source_url?.trim() ?? "",
    imageFiles: [],
    stagingImagePaths: [],
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSessionForPath("/api/admin/products/import-band");
  if (!auth.ok) return auth.res;

  let bandText = "";
  let hwpText = "";
  let golfCourseInfo = "";
  let golfCoursesJson: Array<{ name: string; content: string }> = [];
  let productSourceUrl = "";
  let imageFiles: File[] = [];
  let stagingImagePaths: StagingImageRef[] = [];

  try {
    const parsedBody = await readImportRequest(request);
    bandText = parsedBody.bandText;
    hwpText = parsedBody.hwpText;
    golfCourseInfo = parsedBody.golfCourseInfo;
    golfCoursesJson = parsedBody.golfCoursesJson;
    productSourceUrl = parsedBody.productSourceUrl;
    imageFiles = parsedBody.imageFiles;
    stagingImagePaths = parsedBody.stagingImagePaths;
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
    golfCourseInfo,
    golfCoursesJson,
    productSourceUrl: productSourceUrl || null,
  });

  if (imageFiles.length > 0 || stagingImagePaths.length > 0) {
    try {
      const sources = [
        ...(await filesToBandImportSources(imageFiles)),
        ...(await stagingPathsToBandImportSources(stagingImagePaths)),
      ];
      const applied = await processBandImportImages({
        sources,
        itinerary: (insertPayload.itinerary_v2_json as ItineraryV2 | null) ?? null,
      });
      insertPayload.image_url = applied.imageUrl;
      insertPayload.images_json = applied.imagesJson;
      insertPayload.itinerary_v2_json = applied.itinerary;
    } catch (error) {
      if (error instanceof BandImportImageError) {
        return NextResponse.json({ message: error.message }, { status: error.httpStatus });
      }
      console.error("[import-band] image import failed:", error);
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "사진 업로드에 실패했습니다." },
        { status: 500 },
      );
    } finally {
      if (stagingImagePaths.length > 0) {
        await deleteBandImportStagingFiles(stagingImagePaths.map((item) => item.path));
      }
    }
  }

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
