import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("reviews")
    .select("id,member_id,author_name,title,content,image_url,image_urls,created_at,members(username)")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ message: "후기 목록 조회에 실패했습니다." }, { status: 500 });
  }

  const normalized = (data ?? []).map((row) => {
    const value = row as Record<string, unknown>;
    const memberInfo = value.members as { username?: string } | null;
    return {
      id: String(value.id ?? ""),
      member_id: String(value.member_id ?? ""),
      author_name: String(value.author_name ?? ""),
      title: String(value.title ?? ""),
      content: String(value.content ?? ""),
      image_url: typeof value.image_url === "string" ? value.image_url : null,
      image_urls: Array.isArray(value.image_urls)
        ? value.image_urls.filter((item): item is string => typeof item === "string")
        : [],
      created_at: typeof value.created_at === "string" ? value.created_at : null,
      member_username: memberInfo?.username ?? null,
    };
  });

  return NextResponse.json(normalized);
}
