import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { HomeHeroContent } from "@/types/homeHeroContent";

function normalize(row: Record<string, unknown>): HomeHeroContent {
  return {
    id: String(row.id ?? ""),
    badge: typeof row.badge === "string" ? row.badge : null,
    main_copy_accent: typeof row.main_copy_accent === "string" ? row.main_copy_accent : null,
    main_copy_tail: typeof row.main_copy_tail === "string" ? row.main_copy_tail : null,
    sub_description: typeof row.sub_description === "string" ? row.sub_description : null,
    bullet_1: typeof row.bullet_1 === "string" ? row.bullet_1 : null,
    bullet_2: typeof row.bullet_2 === "string" ? row.bullet_2 : null,
    bullet_3: typeof row.bullet_3 === "string" ? row.bullet_3 : null,
    recommended_text: typeof row.recommended_text === "string" ? row.recommended_text : null,
    search_placeholder: typeof row.search_placeholder === "string" ? row.search_placeholder : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

type HeroContentBody = {
  badge?: string | null;
  main_copy_accent?: string | null;
  main_copy_tail?: string | null;
  sub_description?: string | null;
  bullet_1?: string | null;
  bullet_2?: string | null;
  bullet_3?: string | null;
  recommended_text?: string | null;
  search_placeholder?: string | null;
};

export async function GET() {
  const { data, error } = await supabase
    .from("home_hero_content")
    .select("*")
    .limit(1)
    .order("created_at", { ascending: true })
    .maybeSingle();

  if (error) {
    const message =
      error.code === "42P01"
        ? "home_hero_content 테이블이 없습니다. Supabase 대시보드에서 supabase/home_hero_content.sql 내용을 실행해 주세요."
        : error.message || "히어로 문구 조회에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(null);
  }

  return NextResponse.json(normalize(data as Record<string, unknown>));
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as HeroContentBody;

  const { data: existing, error: fetchError } = await supabase
    .from("home_hero_content")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    const msg =
      fetchError.code === "42P01"
        ? "home_hero_content 테이블이 없습니다. Supabase 대시보드에서 supabase/home_hero_content.sql 내용을 실행해 주세요."
        : fetchError.message || "히어로 문구 조회에 실패했습니다.";
    return NextResponse.json({ message: msg }, { status: 500 });
  }

  const payload = {
    badge: body.badge !== undefined ? (body.badge?.trim() || null) : undefined,
    main_copy_accent: body.main_copy_accent !== undefined ? (body.main_copy_accent?.trim() || null) : undefined,
    main_copy_tail: body.main_copy_tail !== undefined ? (body.main_copy_tail?.trim() || null) : undefined,
    sub_description: body.sub_description !== undefined ? (body.sub_description?.trim() || null) : undefined,
    bullet_1: body.bullet_1 !== undefined ? (body.bullet_1?.trim() || null) : undefined,
    bullet_2: body.bullet_2 !== undefined ? (body.bullet_2?.trim() || null) : undefined,
    bullet_3: body.bullet_3 !== undefined ? (body.bullet_3?.trim() || null) : undefined,
    recommended_text: body.recommended_text !== undefined ? (body.recommended_text?.trim() || null) : undefined,
    search_placeholder: body.search_placeholder !== undefined ? (body.search_placeholder?.trim() || null) : undefined,
    updated_at: new Date().toISOString(),
  };

  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;

  if (existing?.id) {
    const { data: updated, error } = await supabase
      .from("home_hero_content")
      .update(cleanPayload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      const msg =
        error.code === "42P01"
          ? "home_hero_content 테이블이 없습니다. Supabase에서 supabase/home_hero_content.sql 을 실행해 주세요."
          : error.message || "히어로 문구 수정에 실패했습니다.";
      return NextResponse.json({ message: msg }, { status: 500 });
    }
    revalidateTag("home-hero-content", "max");
    revalidatePath("/");
    return NextResponse.json(normalize(updated as Record<string, unknown>));
  }

  const { data: inserted, error } = await supabase
    .from("home_hero_content")
    .insert({
      badge: cleanPayload.badge ?? null,
      main_copy_accent: cleanPayload.main_copy_accent ?? null,
      main_copy_tail: cleanPayload.main_copy_tail ?? null,
      sub_description: cleanPayload.sub_description ?? null,
      bullet_1: cleanPayload.bullet_1 ?? null,
      bullet_2: cleanPayload.bullet_2 ?? null,
      bullet_3: cleanPayload.bullet_3 ?? null,
      recommended_text: cleanPayload.recommended_text ?? null,
      search_placeholder: cleanPayload.search_placeholder ?? null,
    })
    .select("*")
    .single();

  if (error) {
    const msg =
      error.code === "42P01"
        ? "home_hero_content 테이블이 없습니다. Supabase에서 supabase/home_hero_content.sql 을 실행해 주세요."
        : error.message || "히어로 문구 등록에 실패했습니다.";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
  revalidateTag("home-hero-content", "max");
  revalidatePath("/");
  return NextResponse.json(normalize(inserted as Record<string, unknown>));
}
