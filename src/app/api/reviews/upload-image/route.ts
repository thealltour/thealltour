/**
 * PR12: 리뷰 이미지 업로드 API.
 * - 클라이언트에서 WebP(또는 jpeg/png) 파일 전송 → 서버에서 thumb/medium/original 생성 후 Storage 업로드.
 * - 응답: medium URL (DB image_urls에 저장).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getReviewById } from "@/lib/reviews";
import { uploadReviewImageServer } from "@/lib/reviewImageUploadServer";
import {
  MAX_REVIEW_IMAGE_SIZE_BYTES,
  REVIEW_IMAGE_ALLOWED_MIME_TYPES,
} from "@/lib/constants/review";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  const formData = await request.formData();
  const file = formData.get("file");
  const reviewId = formData.get("reviewId");
  const indexStr = formData.get("index");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ message: "파일이 없습니다." }, { status: 400 });
  }
  const reviewIdStr = typeof reviewId === "string" ? reviewId.trim() : "";
  if (!reviewIdStr) {
    return NextResponse.json({ message: "reviewId가 필요합니다." }, { status: 400 });
  }

  const review = await getReviewById(reviewIdStr);
  if (!review) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }

  // 회원: 세션 필요, 본인 후기만 수정 가능
  if (review.member_id != null) {
    if (!session) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }
    if (review.member_id !== session.memberId) {
      return NextResponse.json({ message: "본인 후기에만 이미지를 올릴 수 있습니다." }, { status: 403 });
    }
  }
  // 비회원 후기(member_id null): 세션 없이 업로드 허용 (본인 작성 후기만 편집 가능하도록 reviewId로 식별)

  if (review.status === "submitted") {
    return NextResponse.json({ message: "제출된 후기는 수정할 수 없습니다." }, { status: 400 });
  }

  if (!REVIEW_IMAGE_ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ message: "jpg, png, webp, gif만 업로드할 수 있습니다." }, { status: 400 });
  }
  if (file.size > MAX_REVIEW_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ message: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
  }

  const index = indexStr != null ? Math.max(0, parseInt(String(indexStr), 10) || 0) : 0;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await uploadReviewImageServer(buffer, reviewIdStr, index);
    return NextResponse.json({
      url: result.mediumUrl,
      mediumUrl: result.mediumUrl,
      originalUrl: result.originalUrl,
      thumbUrl: result.thumbUrl,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "이미지 업로드에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
