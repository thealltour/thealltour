import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { ItineraryV2 } from "@/types/product";

function isMissingImagesJsonColumn(message?: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("images_json") && normalized.includes("column");
}

/** PostgreSQL integer 컬럼용: 과학적 표기·부동소수·범위 초과 시 null */
function toSafeInteger(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.round(n);
  if (int < -2147483648 || int > 2147483647) return null;
  return int;
}

type ProductBody = {
  title?: string;
  description?: string;
  product_source_url?: string | null;
  point_benefits?: string | null;
  point_tourism?: string | null;
  point_guide?: string | null;
  meeting_info?: string | null;
  travel_insurance?: string | null;
  included_items?: string | null;
  excluded_items?: string | null;
  detailed_schedule?: string | null;
  optional_tours?: string | null;
  min_departure_people?: string | null;
  terms_and_notes?: string | null;
  terms_template_type?: string | null;
  departure_from_airport?: string | null;
  departure_from_date?: string | null;
  departure_from_time?: string | null;
  departure_to_airport?: string | null;
  departure_to_date?: string | null;
  departure_to_time?: string | null;
  departure_flight_name?: string | null;
  departure_baggage_limit?: string | null;
  arrival_from_airport?: string | null;
  arrival_from_date?: string | null;
  arrival_from_time?: string | null;
  arrival_to_airport?: string | null;
  arrival_to_date?: string | null;
  arrival_to_time?: string | null;
  arrival_flight_name?: string | null;
  arrival_baggage_limit?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  image_url?: string;
  images_json?: string[] | null;
  /** TODO: cardUrl 분리 저장 시 추가. docs/design/product-image-card-url-extension.md */
  // image_card_url?: string;
  category?: string;
  theme?: string | null;
  price?: number | null;
  duration?: string | null;
  itinerary?: string | null;
  inclusions?: string | null;
  is_active?: boolean;
  sort_order?: number | null;
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED" | null;
  fuel_included?: boolean | null;
  price_meta?: string | null;
  meta_info?: string | null;
  one_liner?: string | null;
  options?: Record<string, unknown> | null;
  itinerary_media_json?: Record<string, string> | null;
  /** [STEP 0] 구조화 일정 */
  itinerary_days_json?: Array<{
    day: number;
    dateText?: string;
    title?: string;
    coverImageUrl?: string | null;
    events: Array<{
      heading: string;
      description?: string;
      timeOfDay?: "오전" | "오후" | "저녁" | "종일";
      iconKey?: string;
    }>;
  }> | null;
  /** [STEP 1] 구조화 일정 v2 (jsonb 1컬럼) */
  itinerary_v2_json?: ItineraryV2 | null;
  /** 일정 테마 구성비. { items: [{ label, percent }] } */
  theme_chart_json?: { items: Array<{ label: string; percent: number }> } | null;
  overview_accommodation?: string | null;
  overview_region?: string | null;
  overview_duration?: string | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "8");
  const sortField = (searchParams.get("sortField") ?? "sort_order") as
    | "title"
    | "category"
    | "price"
    | "sort_order"
    | "created_at";
  const sortDirection = (searchParams.get("sortDirection") ?? "asc") === "desc" ? "desc" : "asc";
  const keyword = (searchParams.get("q") ?? "").trim();

  try {
    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize - 1;

    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .order(sortField, { ascending: sortDirection === "asc", nullsFirst: false })
      .range(from, to);

    if (keyword !== "") {
      const ilike = `%${keyword}%`;
      query = query.or(
        `title.ilike.${ilike},description.ilike.${ilike},category.ilike.${ilike},theme.ilike.${ilike},product_source_url.ilike.${ilike}`,
      );
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { message: `상품 목록 조회에 실패했습니다. (${error.message})` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      items: data ?? [],
      total: count ?? 0,
    });
  } catch (error) {
    console.error("Failed to load products", error);
    return NextResponse.json(
      { message: "상품 목록 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as ProductBody;
  const title = body.title?.trim();
  const description = body.description?.trim();
  const images = Array.isArray(body.images_json)
    ? body.images_json.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
    : [];
  const imageUrl = body.image_url?.trim() || images[0];
  const category = body.category?.trim() || "여행상품";

  const sourceUrl = body.product_source_url?.trim();
  if (sourceUrl) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("product_source_url", sourceUrl)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json(
        {
          message: "이미 같은 원본 URL로 생성된 상품이 있습니다.",
          existingId: existing.id,
        },
        { status: 409 },
      );
    }
  }

  if (!title || !description || !imageUrl) {
    return NextResponse.json(
      { message: "상품명, 설명, 이미지 URL은 필수입니다." },
      { status: 400 },
    );
  }

  const insertPayload: Record<string, unknown> = {
    title,
    description,
    image_url: imageUrl,
    images_json: images.length > 0 ? images : null,
    category,
    theme: body.theme?.trim() || null,
    price: toSafeInteger(body.price),
    duration: body.duration?.trim() || null,
    itinerary: body.itinerary?.trim() || null,
    inclusions: body.inclusions?.trim() || null,
    is_active: body.is_active ?? true,
    sort_order: toSafeInteger(body.sort_order),
  };

  if (body.meta_title !== undefined) {
    insertPayload.meta_title = body.meta_title?.trim() || null;
  }
  if (body.meta_description !== undefined) {
    insertPayload.meta_description = body.meta_description?.trim() || null;
  }
  if (body.point_benefits !== undefined) {
    insertPayload.point_benefits = body.point_benefits?.trim() || null;
  }
  if (body.point_tourism !== undefined) {
    insertPayload.point_tourism = body.point_tourism?.trim() || null;
  }
  if (body.point_guide !== undefined) {
    insertPayload.point_guide = body.point_guide?.trim() || null;
  }
  if (body.meeting_info !== undefined) {
    insertPayload.meeting_info = body.meeting_info?.trim() || null;
  }
  if (body.travel_insurance !== undefined) {
    insertPayload.travel_insurance = body.travel_insurance?.trim() || null;
  }
  if (body.included_items !== undefined) {
    insertPayload.included_items = body.included_items?.trim() || null;
  }
  if (body.excluded_items !== undefined) {
    insertPayload.excluded_items = body.excluded_items?.trim() || null;
  }
  if (body.detailed_schedule !== undefined) {
    insertPayload.detailed_schedule = body.detailed_schedule?.trim() || null;
  }
  if (body.optional_tours !== undefined) {
    insertPayload.optional_tours = body.optional_tours?.trim() || null;
  }
  if (body.min_departure_people !== undefined) {
    insertPayload.min_departure_people = body.min_departure_people?.trim() || null;
  }
  if (body.terms_and_notes !== undefined) {
    insertPayload.terms_and_notes = body.terms_and_notes?.trim() || null;
  }
  if (body.terms_template_type !== undefined) {
    insertPayload.terms_template_type = body.terms_template_type?.trim() || null;
  }
  if (body.product_source_url !== undefined) {
    insertPayload.product_source_url = body.product_source_url?.trim() || null;
  }
  if (body.departure_from_airport !== undefined) {
    insertPayload.departure_from_airport = body.departure_from_airport?.trim() || null;
  }
  if (body.departure_from_date !== undefined) {
    insertPayload.departure_from_date = body.departure_from_date?.trim() || null;
  }
  if (body.departure_from_time !== undefined) {
    insertPayload.departure_from_time = body.departure_from_time?.trim() || null;
  }
  if (body.departure_to_airport !== undefined) {
    insertPayload.departure_to_airport = body.departure_to_airport?.trim() || null;
  }
  if (body.departure_to_date !== undefined) {
    insertPayload.departure_to_date = body.departure_to_date?.trim() || null;
  }
  if (body.departure_to_time !== undefined) {
    insertPayload.departure_to_time = body.departure_to_time?.trim() || null;
  }
  if (body.departure_flight_name !== undefined) {
    insertPayload.departure_flight_name = body.departure_flight_name?.trim() || null;
  }
  if (body.departure_baggage_limit !== undefined) {
    insertPayload.departure_baggage_limit = body.departure_baggage_limit?.trim() || null;
  }
  if (body.arrival_from_airport !== undefined) {
    insertPayload.arrival_from_airport = body.arrival_from_airport?.trim() || null;
  }
  if (body.arrival_from_date !== undefined) {
    insertPayload.arrival_from_date = body.arrival_from_date?.trim() || null;
  }
  if (body.arrival_from_time !== undefined) {
    insertPayload.arrival_from_time = body.arrival_from_time?.trim() || null;
  }
  if (body.arrival_to_airport !== undefined) {
    insertPayload.arrival_to_airport = body.arrival_to_airport?.trim() || null;
  }
  if (body.arrival_to_date !== undefined) {
    insertPayload.arrival_to_date = body.arrival_to_date?.trim() || null;
  }
  if (body.arrival_to_time !== undefined) {
    insertPayload.arrival_to_time = body.arrival_to_time?.trim() || null;
  }
  if (body.arrival_flight_name !== undefined) {
    insertPayload.arrival_flight_name = body.arrival_flight_name?.trim() || null;
  }
  if (body.arrival_baggage_limit !== undefined) {
    insertPayload.arrival_baggage_limit = body.arrival_baggage_limit?.trim() || null;
  }
  if (body.status !== undefined) {
    insertPayload.status = body.status && ["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"].includes(body.status) ? body.status : null;
  }
  if (body.fuel_included !== undefined) {
    insertPayload.fuel_included = typeof body.fuel_included === "boolean" ? body.fuel_included : null;
  }
  if (body.price_meta !== undefined) {
    insertPayload.price_meta = body.price_meta?.trim() || null;
  }
  if (body.meta_info !== undefined) {
    insertPayload.meta_info = body.meta_info?.trim() || null;
  }
  if (body.one_liner !== undefined) {
    insertPayload.one_liner = body.one_liner?.trim() || null;
  }
  if (body.options !== undefined) {
    insertPayload.options = body.options && typeof body.options === "object" ? body.options : null;
  }
  if (body.itinerary_media_json !== undefined) {
    insertPayload.itinerary_media_json =
      body.itinerary_media_json && typeof body.itinerary_media_json === "object"
        ? body.itinerary_media_json
        : null;
  }
  if (body.itinerary_days_json !== undefined) {
    insertPayload.itinerary_days_json =
      Array.isArray(body.itinerary_days_json) && body.itinerary_days_json.length > 0
        ? body.itinerary_days_json
        : null;
  }
  if (body.itinerary_v2_json !== undefined) {
    insertPayload.itinerary_v2_json =
      body.itinerary_v2_json &&
      typeof body.itinerary_v2_json === "object" &&
      Array.isArray(body.itinerary_v2_json.days) &&
      body.itinerary_v2_json.days.length > 0
        ? body.itinerary_v2_json
        : null;
  }
  if (body.theme_chart_json !== undefined) {
    const items = body.theme_chart_json?.items;
    const filtered = Array.isArray(items)
      ? items.filter((i) => i?.label?.trim() && typeof i.percent === "number")
      : [];
    insertPayload.theme_chart_json = filtered.length >= 2 ? { items: filtered } : null;
  }
  if (body.overview_accommodation !== undefined) {
    insertPayload.overview_accommodation = body.overview_accommodation?.trim() || null;
  }
  if (body.overview_region !== undefined) {
    insertPayload.overview_region = body.overview_region?.trim() || null;
  }
  if (body.overview_duration !== undefined) {
    insertPayload.overview_duration = body.overview_duration?.trim() || null;
  }
  // overview_json: 저장 제거. 상세 화면은 mapProductToOverview(product)로 자동 생성

  let imagesJsonPersisted = true;
  let insertResult = await supabase
    .from("products")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  // DB에 images_json 컬럼이 아직 없는 환경 호환
  if (insertResult.error && "images_json" in insertPayload && isMissingImagesJsonColumn(insertResult.error.message)) {
    imagesJsonPersisted = false;
    const { images_json: _omit, ...fallbackPayload } = insertPayload;
    insertResult = await supabase
      .from("products")
      .insert(fallbackPayload)
      .select("id")
      .maybeSingle();
  }

  if (insertResult.error) {
    return NextResponse.json(
      { message: `상품 등록에 실패했습니다. (${insertResult.error.message})` },
      { status: 500 },
    );
  }
  if (!insertResult.data) {
    return NextResponse.json(
      { message: "상품 등록 권한이 없습니다. (RLS 정책 확인 필요)" },
      { status: 403 },
    );
  }

  revalidateTag("products", "max");
  const createdId = insertResult.data?.id ?? null;
  if (!imagesJsonPersisted) {
    return NextResponse.json(
      {
        message: "상품이 등록되었습니다. (대표 이미지만 저장됨)",
        warningCode: "IMAGES_JSON_NOT_PERSISTED",
        id: createdId,
      },
      { status: 201 },
    );
  }
  return NextResponse.json({ message: "상품이 등록되었습니다.", id: createdId }, { status: 201 });
}
