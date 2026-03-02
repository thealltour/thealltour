import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  const secret =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-revalidate-token") ??
    "";

  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Invalid revalidate token" }, { status: 401 });
  }

  let body: { path?: string; slug?: string } = {};
  try {
    body = (await request.json()) as { path?: string; slug?: string };
  } catch {
    // ignore, allow empty body
  }

  const targetPath =
    (body.path && typeof body.path === "string" && body.path) ||
    (body.slug && typeof body.slug === "string" ? `/guides/${body.slug}` : null);

  if (!targetPath) {
    return NextResponse.json({ message: "path 또는 slug가 필요합니다." }, { status: 400 });
  }

  revalidatePath(targetPath);

  return NextResponse.json({ revalidated: true, path: targetPath });
}

