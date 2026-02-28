import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";

const FEATURED_PRODUCT_LIMIT = 8;

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
  arrival_from_airport?: string | null;
  arrival_from_date?: string | null;
  arrival_from_time?: string | null;
  arrival_to_airport?: string | null;
  arrival_to_date?: string | null;
  arrival_to_time?: string | null;
  arrival_flight_name?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  image_url?: string;
  category?: string;
  theme?: string | null;
  price?: number | null;
  duration?: string | null;
  itinerary?: string | null;
  inclusions?: string | null;
  is_active?: boolean;
  is_featured_home?: boolean;
  sort_order?: number | null;
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED" | null;
  fuel_included?: boolean | null;
  price_meta?: string | null;
  meta_info?: string | null;
  one_liner?: string | null;
  options?: Record<string, unknown> | null;
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
  const featuredOnly = searchParams.get("featuredOnly") === "true";

  try {
    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize - 1;

    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .order("is_featured_home", { ascending: false, nullsFirst: false })
      .order(sortField, { ascending: sortDirection === "asc", nullsFirst: false })
      .range(from, to);

    if (featuredOnly) {
      query = query.eq("is_featured_home", true);
    }

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
  const imageUrl = body.image_url?.trim();
  const category = body.category?.trim() || "여행상품";

  if (!title || !description || !imageUrl) {
    return NextResponse.json(
      { message: "상품명, 설명, 이미지 URL은 필수입니다." },
      { status: 400 },
    );
  }

  if (body.is_featured_home === true) {
    const featuredCountQuery = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_featured_home", true);

    if (featuredCountQuery.error) {
      return NextResponse.json({ message: "추천상품 개수 확인에 실패했습니다." }, { status: 500 });
    }
    if ((featuredCountQuery.count ?? 0) >= FEATURED_PRODUCT_LIMIT) {
      return NextResponse.json(
        { message: `메인 추천상품은 최대 ${FEATURED_PRODUCT_LIMIT}개까지 설정할 수 있습니다.` },
        { status: 400 },
      );
    }
  }

  const insertPayload: Record<string, unknown> = {
    title,
    description,
    image_url: imageUrl,
    category,
    theme: body.theme?.trim() || null,
    price: typeof body.price === "number" ? body.price : null,
    duration: body.duration?.trim() || null,
    itinerary: body.itinerary?.trim() || null,
    inclusions: body.inclusions?.trim() || null,
      // 추천상품은 메인 노출을 위해 자동 활성화합니다.
      is_active: body.is_featured_home ? true : (body.is_active ?? true),
    is_featured_home: body.is_featured_home ?? false,
    sort_order: typeof body.sort_order === "number" ? body.sort_order : null,
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

  const insertResult = await supabase
    .from("products")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (insertResult.error) {
    return NextResponse.json({ message: "상품 등록에 실패했습니다." }, { status: 500 });
  }
  if (!insertResult.data) {
    return NextResponse.json(
      { message: "상품 등록 권한이 없습니다. (RLS 정책 확인 필요)" },
      { status: 403 },
    );
  }

  revalidateTag("products", "max");
  return NextResponse.json({ message: "상품이 등록되었습니다." }, { status: 201 });
}
