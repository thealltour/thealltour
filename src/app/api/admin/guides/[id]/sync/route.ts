import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncGuideFromNotion } from "@/lib/notionSync";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "알 수 없는 오류";
}

export async function POST(_: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "가이드 ID가 올바르지 않습니다." }, { status: 400 });
  }

  let guide = null;
  try {
    guide = await syncGuideFromNotion(id);
  } catch (error) {
    const reason = getErrorMessage(error);
    return NextResponse.json(
      { message: `노션 동기화 중 오류가 발생했습니다. (${reason})` },
      { status: 500 },
    );
  }
  if (!guide) {
    return NextResponse.json({ message: "노션 동기화에 실패했습니다." }, { status: 500 });
  }

  if (guide.slug) {
    revalidatePath(`/guides/${guide.slug}`);
  }
  revalidatePath("/guides");

  return NextResponse.json({ message: "노션 동기화 및 캐시 갱신이 완료되었습니다." });
}

