import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";

const FEATURED_PRODUCT_LIMIT = 8;

type ProductBody = {
  title?: string;
  description?: string;
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
};

export async function GET() {
  const sortedByOrderAndCreatedAt = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (!sortedByOrderAndCreatedAt.error) {
    return NextResponse.json(sortedByOrderAndCreatedAt.data ?? []);
  }

  const sortedByOrderOnly = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false });

  if (!sortedByOrderOnly.error) {
    return NextResponse.json(sortedByOrderOnly.data ?? []);
  }

  const selectOnly = await supabase.from("products").select("*");
  if (!selectOnly.error) {
    return NextResponse.json(selectOnly.data ?? []);
  }

  return NextResponse.json(
    { message: `상품 목록 조회에 실패했습니다. (${selectOnly.error.message})` },
    { status: 500 },
  );
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

  const insertResult = await supabase
    .from("products")
    .insert({
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
    })
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

  revalidateTag("products");
  return NextResponse.json({ message: "상품이 등록되었습니다." }, { status: 201 });
}
