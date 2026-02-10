import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { HomeBanner } from "@/types/homeBanner";

type BannerBody = {
  title?: string;
  image_url?: string;
  mobile_image_url?: string | null;
  link_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
};

function normalize(row: Record<string, unknown>): HomeBanner {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    image_url: String(row.image_url ?? ""),
    mobile_image_url:
      typeof row.mobile_image_url === "string" && row.mobile_image_url.trim() !== ""
        ? row.mobile_image_url
        : null,
    link_url:
      typeof row.link_url === "string" && row.link_url.trim() !== "" ? row.link_url : null,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export async function GET() {
  const result = await supabase
    .from("home_banners")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (result.error) {
    return NextResponse.json({ message: "배너 목록 조회에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json((result.data ?? []).map((row) => normalize(row as Record<string, unknown>)));
}

export async function POST(request: Request) {
  const body = (await request.json()) as BannerBody;
  const title = body.title?.trim() ?? "";
  const imageUrl = body.image_url?.trim() ?? "";

  if (!title || !imageUrl) {
    return NextResponse.json({ message: "배너 제목과 PC 배너 이미지 URL은 필수입니다." }, { status: 400 });
  }

  const insertResult = await supabase
    .from("home_banners")
    .insert({
      title,
      image_url: imageUrl,
      mobile_image_url: body.mobile_image_url?.trim() || null,
      link_url: body.link_url?.trim() || null,
      sort_order: typeof body.sort_order === "number" ? body.sort_order : null,
      is_active: body.is_active ?? true,
    })
    .select("id")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ message: "배너 추가에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "배너가 추가되었습니다." }, { status: 201 });
}
