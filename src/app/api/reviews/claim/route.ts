import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { claimEligibility } from "@/lib/reviewEligibilities";

type ClaimBody = {
  claim_token?: string;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.json(
      { message: "로그인이 필요합니다.", error: "unauthorized" },
      { status: 401 },
    );
  }

  const body = (await request.json()) as ClaimBody;
  const claimToken = body.claim_token?.trim();

  if (!claimToken) {
    return NextResponse.json(
      { message: "claim_token이 필요합니다.", error: "invalid_request" },
      { status: 400 },
    );
  }

  const result = await claimEligibility(claimToken, session.memberId);

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: "후기 작성 권한이 연결되었습니다.",
      eligibility_id: result.eligibility_id,
    });
  }

  switch (result.error) {
    case "not_found":
      return NextResponse.json(
        { success: false, message: "유효하지 않은 후기 링크입니다.", error: result.error },
        { status: 404 },
      );
    case "expired":
      return NextResponse.json(
        { success: false, message: "후기 작성 링크가 만료되었습니다.", error: result.error },
        { status: 410 },
      );
    case "already_submitted":
      return NextResponse.json(
        { success: false, message: "이미 후기가 작성된 여행건입니다.", error: result.error },
        { status: 409 },
      );
    case "already_claimed_by_other":
      return NextResponse.json(
        { success: false, message: "이미 다른 계정에서 연결된 후기 권한입니다.", error: result.error },
        { status: 409 },
      );
    default:
      return NextResponse.json(
        { success: false, message: "후기 권한 연결에 실패했습니다.", error: "unknown" },
        { status: 500 },
      );
  }
}
