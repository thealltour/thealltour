import { supabase } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";
import { syncMemberCustomerProfiles } from "@/lib/customerAccountLinks";
import { createMemberSessionToken } from "@/lib/memberSession";
import { parseIdentifier } from "@/lib/members/identifier";

export type LoginMemberResult =
  | { ok: true; token: string; memberId: string }
  | { ok: false; status: number; message: string };

export async function loginMemberWithCredentials(input: {
  username?: string;
  identifier?: string;
  password: string;
}): Promise<LoginMemberResult> {
  const password = input.password ?? "";
  const parsed = input.identifier?.trim()
    ? parseIdentifier(input.identifier)
  : input.username?.trim()
      ? { kind: "username" as const, value: input.username.trim() }
      : null;

  if (!parsed || !password) {
    return { ok: false, status: 400, message: "아이디와 비밀번호를 입력해 주세요." };
  }

  const field = parsed.kind === "email" ? "email" : parsed.kind === "phone" ? "phone" : "username";

  let query = supabase
    .from("members")
    .select("id,username,name,phone,email,password_hash,password_salt,points");

  if (parsed.kind === "email") {
    query = query.ilike("email", parsed.value);
  } else {
    query = query.eq(field, parsed.value);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return { ok: false, status: 401, message: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  if (!data.password_hash || !data.password_salt) {
    return {
      ok: false,
      status: 401,
      message: "소셜 로그인으로 가입한 계정입니다. 소셜 로그인을 이용해 주세요.",
    };
  }

  const passwordOk = verifyPassword(password, String(data.password_salt), String(data.password_hash));
  if (!passwordOk) {
    return { ok: false, status: 401, message: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  const memberId = String(data.id);

  await syncMemberCustomerProfiles({
    memberId,
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    linked_by: "self",
  }).catch((err) => {
    console.error("[members/login] syncMemberCustomerProfiles failed", err);
  });

  const token = createMemberSessionToken({
    memberId,
    username: String(data.username),
    name: String(data.name),
  });

  return { ok: true, token, memberId };
}
