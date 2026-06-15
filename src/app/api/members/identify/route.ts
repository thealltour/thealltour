import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { maskIdentifier, parseIdentifier } from "@/lib/members/identifier";

type IdentifyBody = {
  identifier?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as IdentifyBody;
  const parsed = parseIdentifier(body.identifier ?? "");

  if (!parsed) {
    return NextResponse.json(
      { message: "이메일 주소 또는 휴대폰 번호를 올바르게 입력해 주세요." },
      { status: 400 },
    );
  }

  if (parsed.kind === "phone") {
    const { data, error } = await supabase
      .from("members")
      .select("id,password_hash,password_salt")
      .eq("phone", parsed.value);

    if (error) {
      return NextResponse.json({ message: "계정 확인 중 오류가 발생했습니다." }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        status: "register",
        identifierKind: parsed.kind,
        maskedIdentifier: maskIdentifier(parsed.kind, parsed.value),
      });
    }

    if (data.length > 1) {
      return NextResponse.json(
        { message: "해당 번호로 여러 계정이 있습니다. 이메일 주소로 다시 시도해 주세요." },
        { status: 409 },
      );
    }

    const member = data[0];
    if (!member.password_hash || !member.password_salt) {
      return NextResponse.json({
        status: "social_only",
        identifierKind: parsed.kind,
        maskedIdentifier: maskIdentifier(parsed.kind, parsed.value),
      });
    }

    return NextResponse.json({
      status: "login",
      identifierKind: parsed.kind,
      maskedIdentifier: maskIdentifier(parsed.kind, parsed.value),
    });
  }

  const field = parsed.kind === "email" ? "email" : "username";
  let query = supabase.from("members").select("id,password_hash,password_salt");

  if (parsed.kind === "email") {
    query = query.ilike("email", parsed.value);
  } else {
    query = query.eq(field, parsed.value);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return NextResponse.json({ message: "계정 확인 중 오류가 발생했습니다." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      status: "register",
      identifierKind: parsed.kind,
      maskedIdentifier: maskIdentifier(parsed.kind, parsed.value),
    });
  }

  if (!data.password_hash || !data.password_salt) {
    return NextResponse.json({
      status: "social_only",
      identifierKind: parsed.kind,
      maskedIdentifier: maskIdentifier(parsed.kind, parsed.value),
    });
  }

  return NextResponse.json({
    status: "login",
    identifierKind: parsed.kind,
    maskedIdentifier: maskIdentifier(parsed.kind, parsed.value),
  });
}
