import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getReviews } from "@/lib/reviews";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { createNewReviewNotification } from "@/lib/adminNotifications";

type ReviewBody = {
  title?: string;
  content?: string;
  image_url?: string | null;
  image_urls?: string[];
  rating?: number;
};

const MAX_REVIEW_IMAGES = 4;

export async function GET() {
  const reviews = await getReviews();
  return NextResponse.json(reviews);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return NextResponse.json({ message: "회원 로그인 후 작성할 수 있습니다." }, { status: 401 });
  }

  const body = (await request.json()) as ReviewBody;
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

  const payload = {
    member_id: session.memberId,
    author_name: session.name,
    title,
    content,
    image_url: imageUrl,
    image_urls: imageUrls,
    rating: rating ?? null,
  };

  const insertWithArray = await supabase
    .from("reviews")
    .insert(payload)
    .select("id,title,author_name")
    .maybeSingle();
  if (insertWithArray.error) {
    const insertLegacy = await supabase
      .from("reviews")
      .insert({
        member_id: session.memberId,
        author_name: session.name,
        title,
        content,
        image_url: imageUrl,
      })
      .select("id,title,author_name")
      .maybeSingle();
    if (insertLegacy.error || !insertLegacy.data) {
      return NextResponse.json({ message: "후기 등록에 실패했습니다." }, { status: 500 });
    }
    await createNewReviewNotification({
      reviewId: String(insertLegacy.data.id),
      authorName: String(insertLegacy.data.author_name),
      title: String(insertLegacy.data.title),
    });
    return NextResponse.json({ message: "후기가 등록되었습니다." }, { status: 201 });
  }

  if (insertWithArray.data) {
    await createNewReviewNotification({
      reviewId: String(insertWithArray.data.id),
      authorName: String(insertWithArray.data.author_name),
      title: String(insertWithArray.data.title),
    });
  }

  return NextResponse.json({ message: "후기가 등록되었습니다." }, { status: 201 });
}
