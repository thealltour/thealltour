import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type MemberBody = {
  name?: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  gender?: "male" | "female" | "other";
  agree_email?: boolean;
  points?: number;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as MemberBody;

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.phone !== undefined) updates.phone = body.phone.trim();
  if (body.email !== undefined) updates.email = body.email.trim();
  if (body.birth_date !== undefined) updates.birth_date = body.birth_date.trim();
  if (body.gender !== undefined) updates.gender = body.gender;
  if (body.agree_email !== undefined) updates.agree_email = body.agree_email;
  if (body.points !== undefined) {
    const value = Number.isFinite(body.points) ? Math.max(0, Math.floor(body.points)) : NaN;
    if (Number.isNaN(value)) {
      return NextResponse.json({ message: "포인트는 0 이상의 정수로 입력해 주세요." }, { status: 400 });
    }
    updates.points = value;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const result = await supabase.from("members").update(updates).eq("id", id).select("id").maybeSingle();
  if (result.error) {
    return NextResponse.json({ message: "회원 정보 수정에 실패했습니다." }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json(
      { message: "회원 정보 수정 권한이 없거나 대상 회원을 찾지 못했습니다." },
      { status: 403 },
    );
  }

  return NextResponse.json({ message: "회원 정보가 수정되었습니다." });
}
