import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncGuideFromNotion } from "@/lib/notionSync";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "가이드 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const guide = await syncGuideFromNotion(id);
  if (!guide) {
    return NextResponse.json({ message: "노션 동기화에 실패했습니다." }, { status: 500 });
  }

  if (guide.slug) {
    revalidatePath(`/guides/${guide.slug}`);
  }
  revalidatePath("/guides");
  revalidatePath("/blog");

  return NextResponse.json({ message: "노션 동기화 및 캐시 갱신이 완료되었습니다." });
}

