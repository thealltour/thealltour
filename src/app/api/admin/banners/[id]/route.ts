import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";

type BannerBody = {
  title?: string;
  image_url?: string;
  mobile_image_url?: string | null;
  link_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as BannerBody;
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ message: "배너 제목은 비워둘 수 없습니다." }, { status: 400 });
    }
    updates.title = title;
  }
  if (body.image_url !== undefined) {
    const imageUrl = body.image_url.trim();
    if (!imageUrl) {
      return NextResponse.json({ message: "PC 배너 이미지 URL은 비워둘 수 없습니다." }, { status: 400 });
    }
    updates.image_url = imageUrl;
  }
  if (body.mobile_image_url !== undefined) {
    updates.mobile_image_url = body.mobile_image_url?.trim() || null;
  }
  if (body.link_url !== undefined) {
    updates.link_url = body.link_url?.trim() || null;
  }
  if (body.sort_order !== undefined) {
    updates.sort_order = typeof body.sort_order === "number" ? body.sort_order : null;
  }
  if (body.is_active !== undefined) {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const result = await supabase
    .from("home_banners")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (result.error || !result.data) {
    return NextResponse.json({ message: "배너 수정에 실패했습니다." }, { status: 500 });
  }

  revalidateTag("home-banners");
  return NextResponse.json({ message: "배너가 수정되었습니다." });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const deleteResult = await supabase
    .from("home_banners")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (deleteResult.error || !deleteResult.data) {
    return NextResponse.json({ message: "배너 삭제에 실패했습니다." }, { status: 500 });
  }

  revalidateTag("home-banners");
  return NextResponse.json({ message: "배너가 삭제되었습니다." });
}
