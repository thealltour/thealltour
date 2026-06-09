import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createPasswordHash } from "@/lib/password";
import { createNewMemberNotification } from "@/lib/adminNotifications";
import { syncMemberCustomerProfiles } from "@/lib/customerAccountLinks";
import type { MemberSignupInput } from "@/types/member";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{4,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<MemberSignupInput>;
  const username = body.username?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const password = body.password ?? "";
  const confirmPassword = body.confirmPassword ?? "";
  const phone = normalizePhone(body.phone?.trim() ?? "");
  const email = body.email?.trim() ?? "";
  const birthDate = body.birthDate?.trim() ?? "";
  const gender = body.gender;
  const agreeTerms = body.agreeTerms === true;
  const agreePrivacy = body.agreePrivacy === true;
  const agreeEmail = body.agreeEmail === true;

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { message: "아이디는 4~20자 영문/숫자/밑줄(_)만 가능합니다." },
      { status: 400 },
    );
  }
  if (name.length < 2 || name.length > 30) {
    return NextResponse.json({ message: "이름은 2~30자로 입력해 주세요." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ message: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ message: "비밀번호 확인이 일치하지 않습니다." }, { status: 400 });
  }
  if (phone.length < 10 || phone.length > 11) {
    return NextResponse.json({ message: "연락처를 정확히 입력해 주세요." }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ message: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (!birthDate) {
    return NextResponse.json({ message: "생년월일을 입력해 주세요." }, { status: 400 });
  }
  if (gender !== "male" && gender !== "female" && gender !== "other") {
    return NextResponse.json({ message: "성별을 선택해 주세요." }, { status: 400 });
  }
  if (!agreeTerms || !agreePrivacy) {
    return NextResponse.json({ message: "필수 약관에 동의해 주세요." }, { status: 400 });
  }

  const duplicateCheck = await supabase
    .from("members")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (duplicateCheck.error) {
    return NextResponse.json({ message: "가입 검증 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (duplicateCheck.data) {
    return NextResponse.json({ message: "이미 사용 중인 아이디입니다." }, { status: 409 });
  }

  const { hash, salt } = createPasswordHash(password);

  const insertResult = await supabase
    .from("members")
    .insert({
      username,
      name,
      password_hash: hash,
      password_salt: salt,
      phone,
      email,
      birth_date: birthDate,
      gender,
      agree_terms: agreeTerms,
      agree_privacy: agreePrivacy,
      agree_email: agreeEmail,
    })
    .select("id,username,name")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ message: "회원가입에 실패했습니다." }, { status: 500 });
  }

  const memberId = String(insertResult.data.id);

  await createNewMemberNotification({
    memberId,
    username: String(insertResult.data.username),
    name: String(insertResult.data.name),
  });

  await syncMemberCustomerProfiles({
    memberId,
    phone,
    email,
    linked_by: "self",
  }).catch((err) => {
    console.error("[members/register] syncMemberCustomerProfiles failed", err);
  });

  return NextResponse.json({ message: "회원가입이 완료되었습니다." }, { status: 201 });
}
