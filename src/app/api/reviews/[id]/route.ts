import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

type ReviewUpdateBody = {
  title?: string;
  content?: string;
  image_url?: string | null;
  image_urls?: string[];
  rating?: number;
};

const MAX_REVIEW_IMAGES = 4;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return NextResponse.json({ message: "회원 로그인 후 수정할 수 있습니다." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "후기 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const body = (await request.json()) as ReviewUpdateBody;
  const title = body.title?.trim() ?? "";
  const content = body.content?.trim() ?? "";
  const rawImageUrls = (Array.isArray(body.image_urls) ? body.image_urls : [])
    .map((url) => String(url).trim())
    .filter((url) => url.length > 0);
  const imageUrls = rawImageUrls.slice(0, MAX_REVIEW_IMAGES);
  const imageUrl = imageUrls[0] ?? body.image_url?.trim() ?? null;
  const rating =
    typeof body.rating === "number" && Number.isFinite(body.rating)
      ? Math.round(body.rating)
      : undefined;

  if (!title || !content) {
    return NextResponse.json({ message: "제목과 내용을 입력해 주세요." }, { status: 400 });
  }
  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return NextResponse.json({ message: "별점은 1점에서 5점 사이로 선택해 주세요." }, { status: 400 });
  }
  if (rawImageUrls.length > MAX_REVIEW_IMAGES) {
    return NextResponse.json(
      { message: `이미지는 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.` },
      { status: 400 },
    );
  }
  if (imageUrls.some((url) => url.length > 2000) || (imageUrl && imageUrl.length > 2000)) {
    return NextResponse.json({ message: "이미지 URL이 너무 깁니다." }, { status: 400 });
  }

  const { data: existing, error: findError } = await supabase
    .from("reviews")
    .select("id,member_id")
    .eq("id", id)
    .maybeSingle();

  if (findError || !existing) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }
  if (String(existing.member_id) !== session.memberId) {
    return NextResponse.json({ message: "본인이 작성한 후기만 수정할 수 있습니다." }, { status: 403 });
  }

  const updateWithArray = await supabase
    .from("reviews")
    .update({ title, content, image_url: imageUrl, image_urls: imageUrls, rating: rating ?? null })
    .eq("id", id);

  if (updateWithArray.error) {
    const updateLegacy = await supabase
      .from("reviews")
      .update({ title, content, image_url: imageUrl })
      .eq("id", id);
    if (updateLegacy.error) {
      return NextResponse.json({ message: "후기 수정에 실패했습니다." }, { status: 500 });
    }
  }

  return NextResponse.json({ message: "후기가 수정되었습니다." });
}

export async function DELETE(_: Request, context: RouteContext) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return NextResponse.json({ message: "회원 로그인 후 삭제할 수 있습니다." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "후기 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const { data: existing, error: findError } = await supabase
    .from("reviews")
    .select("id,member_id")
    .eq("id", id)
    .maybeSingle();

  if (findError || !existing) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }
  if (String(existing.member_id) !== session.memberId) {
    return NextResponse.json({ message: "본인이 작성한 후기만 삭제할 수 있습니다." }, { status: 403 });
  }

  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ message: "후기 삭제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "후기가 삭제되었습니다." });
}
