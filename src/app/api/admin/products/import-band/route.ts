import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findExistingProductIdBySourceUrl } from "@/lib/admin/bandImport/checkProductSourceUrl";
import { parseBandProductText } from "@/lib/admin/bandImport/parseBandProductText";
import {
  mapBandParsedToInsert,
  summarizeBandParsedForResponse,
} from "@/lib/admin/bandImport/mapBandParsedToInsert";

function isMissingImagesJsonColumn(message?: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("images_json") && normalized.includes("column");
}

type ImportBandBody = {
  bandText?: string;
  hwpText?: string;
  product_source_url?: string;
  imageUrls?: string[];
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: ImportBandBody;
  try {
    body = (await request.json()) as ImportBandBody;
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const bandText = body.bandText?.trim() ?? "";
  const hwpText = body.hwpText?.trim() ?? "";
  if (!bandText && !hwpText) {
    return NextResponse.json(
      { message: "밴드 본문 또는 HWP 텍스트 중 하나 이상을 입력해 주세요." },
      { status: 400 },
    );
  }

  const productSourceUrl = body.product_source_url?.trim() ?? "";
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

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { message: "OPENAI_API_KEY가 설정되어 있지 않습니다. 배포 환경 변수를 확인해 주세요." },
      { status: 500 },
    );
  }

  let parsed;
  try {
    parsed = await parseBandProductText({ bandText, hwpText });
  } catch (error) {
    console.error("[import-band] AI parse failed:", error);
    const message =
      error instanceof Error && error.message.includes("OPENAI_API_KEY")
        ? error.message
        : "밴드/HWP 텍스트 파싱에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }

  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((v): v is string => typeof v === "string")
    : [];

  const insertPayload = mapBandParsedToInsert({
    parsed,
    bandText,
    hwpText,
    productSourceUrl: productSourceUrl || null,
    imageUrls,
  });

  let insertResult = await supabaseAdmin
    .from("products")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (insertResult.error && "images_json" in insertPayload && isMissingImagesJsonColumn(insertResult.error.message)) {
    const fallbackPayload = Object.fromEntries(
      Object.entries(insertPayload).filter(([key]) => key !== "images_json"),
    );
    insertResult = await supabaseAdmin
      .from("products")
      .insert(fallbackPayload)
      .select("id")
      .maybeSingle();
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
