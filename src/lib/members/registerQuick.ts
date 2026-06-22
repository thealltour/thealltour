import { randomBytes } from "crypto";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPasswordHash } from "@/lib/password";
import { createNewMemberNotification } from "@/lib/adminNotifications";
import { syncMemberCustomerProfiles } from "@/lib/customerAccountLinks";
import { createMemberSessionToken } from "@/lib/memberSession";
import { EMAIL_PATTERN, normalizePhone, parseIdentifier, USERNAME_PATTERN } from "@/lib/members/identifier";

export type QuickRegisterInput = {
  identifier: string;
  name: string;
  password: string;
  confirmPassword: string;
  email?: string;
  phone?: string;
  birthDate: string;
  gender: "male" | "female" | "other";
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeEmail?: boolean;
};

export type QuickRegisterResult =
  | { ok: true; token: string }
  | { ok: false; status: number; message: string };

function sanitizeUsernameBase(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return base.slice(0, 12);
}

async function generateUniqueUsername(email: string) {
  const localPart = email.split("@")[0] ?? "user";
  let base = sanitizeUsernameBase(localPart);
  if (base.length < 4) base = `user_${base}`;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0 ? "" : `_${randomBytes(2).toString("hex")}`;
    const candidate = `${base}${suffix}`.slice(0, 20);
    if (!USERNAME_PATTERN.test(candidate)) continue;

    const { data } = await supabase.from("members").select("id").eq("username", candidate).maybeSingle();
    if (!data) return candidate;
  }

  return `user_${randomBytes(4).toString("hex")}`;
}

export async function registerMemberQuick(body: QuickRegisterInput): Promise<QuickRegisterResult> {
  const parsed = parseIdentifier(body.identifier);
  if (!parsed || (parsed.kind !== "email" && parsed.kind !== "phone")) {
    return { ok: false, status: 400, message: "이메일 주소 또는 휴대폰 번호를 올바르게 입력해 주세요." };
  }

  const name = body.name?.trim() ?? "";
  const password = body.password ?? "";
  const confirmPassword = body.confirmPassword ?? "";
  const birthDate = body.birthDate?.trim() ?? "";
  const gender = body.gender;
  const agreeTerms = body.agreeTerms === true;
  const agreePrivacy = body.agreePrivacy === true;
  const agreeEmail = body.agreeEmail === true;

  let email = parsed.kind === "email" ? parsed.value : body.email?.trim().toLowerCase() ?? "";
  let phone = parsed.kind === "phone" ? parsed.value : normalizePhone(body.phone?.trim() ?? "");

  if (name.length < 2 || name.length > 30) {
    return { ok: false, status: 400, message: "이름은 2~30자로 입력해 주세요." };
  }
  if (password.length < 8) {
    return { ok: false, status: 400, message: "비밀번호는 8자 이상이어야 합니다." };
  }
  if (password !== confirmPassword) {
    return { ok: false, status: 400, message: "비밀번호 확인이 일치하지 않습니다." };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, status: 400, message: "이메일 형식이 올바르지 않습니다." };
  }
  if (phone.length < 10 || phone.length > 11) {
    return { ok: false, status: 400, message: "연락처를 정확히 입력해 주세요." };
  }
  if (!birthDate) {
    return { ok: false, status: 400, message: "생년월일을 입력해 주세요." };
  }
  if (gender !== "male" && gender !== "female" && gender !== "other") {
    return { ok: false, status: 400, message: "성별을 선택해 주세요." };
  }
  if (!agreeTerms || !agreePrivacy) {
    return { ok: false, status: 400, message: "필수 약관에 동의해 주세요." };
  }

  const emailDup = await supabase.from("members").select("id").ilike("email", email).maybeSingle();
  if (emailDup.data) {
    return { ok: false, status: 409, message: "이미 가입된 이메일입니다. 로그인해 주세요." };
  }

  const username = await generateUniqueUsername(email);
  const { hash, salt } = createPasswordHash(password);

  const insertResult = await supabaseAdmin
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
      signup_method: "local",
      profile_completed_at: new Date().toISOString(),
    })
    .select("id,username,name")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return { ok: false, status: 500, message: "회원가입에 실패했습니다." };
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
    console.error("[members/register-quick] syncMemberCustomerProfiles failed", err);
  });

  const token = createMemberSessionToken({
    memberId,
    username: String(insertResult.data.username),
    name: String(insertResult.data.name),
  });

  return { ok: true, token };
}
