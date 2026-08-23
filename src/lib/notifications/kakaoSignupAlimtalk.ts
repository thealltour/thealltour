import { normalizeReceiverPhone } from "@/lib/notifications/sendAligoRelay";
import { sendAlimtalkRelay } from "@/lib/notifications/sendAlimtalkRelay";

/** 알리고 「카카오싱크 회원가입」 템플릿 기본 코드 */
export const DEFAULT_KAKAO_SIGNUP_TPL_CODE = "UK_5796";

/** 템플릿 변수 — 알리고 등록 문구와 동일해야 함 */
export const CUSTOMER_NAME_PLACEHOLDER = "#{고객명}";

const FALLBACK_CUSTOMER_NAME = "고객";

export type KakaoSignupAlimtalkSkipReason =
  | "empty_phone"
  | "missing_message_env"
  | "missing_subject_env";

export type SendKakaoSignupAlimtalkResult =
  | { ok: true; skipped?: undefined }
  | { ok: false; skipped: KakaoSignupAlimtalkSkipReason }
  | { ok: false; error: unknown };

export type SendKakaoSignupAlimtalkInput = {
  phone?: string | null;
  customerName?: string | null;
};

/** 표시용 고객명. 비어 있으면 「고객」. */
export function resolveCustomerName(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed || FALLBACK_CUSTOMER_NAME;
}

/**
 * 승인 템플릿 본문에서 `#{고객명}`만 치환합니다.
 * 다른 `#{...}` 변수는 그대로 둡니다.
 */
export function replaceCustomerNamePlaceholder(template: string, customerName: string): string {
  const name = resolveCustomerName(customerName);
  return template.split(CUSTOMER_NAME_PLACEHOLDER).join(name);
}

function readSignupEnv() {
  const tplCode =
    process.env.ALIGO_KAKAO_TPL_CODE_SIGNUP?.trim() || DEFAULT_KAKAO_SIGNUP_TPL_CODE;
  const subject = process.env.ALIGO_KAKAO_SIGNUP_SUBJECT?.trim() ?? "";
  const messageTemplate = process.env.ALIGO_KAKAO_SIGNUP_MESSAGE ?? "";
  const button = process.env.ALIGO_KAKAO_SIGNUP_BUTTON?.trim() || undefined;
  const failoverRaw = process.env.ALIGO_KAKAO_SIGNUP_FAILOVER?.trim().toUpperCase();
  const failover = failoverRaw === "Y" ? ("Y" as const) : undefined;
  const fsubject = process.env.ALIGO_KAKAO_SIGNUP_FSUBJECT?.trim() || undefined;
  const fmessage = process.env.ALIGO_KAKAO_SIGNUP_FMESSAGE?.trim() || undefined;
  const testModeRaw = process.env.ALIGO_ALIMTALK_TEST_MODE?.trim().toUpperCase();
  const testMode = testModeRaw === "Y" ? ("Y" as const) : undefined;

  return { tplCode, subject, messageTemplate, button, failover, fsubject, fmessage, testMode };
}

/**
 * 카카오싱크 신규 가입 알림톡. env·수신번호 없으면 skip, 전송 실패는 throw하지 않고 결과로 반환.
 */
export async function sendKakaoSignupAlimtalk(
  input: SendKakaoSignupAlimtalkInput,
): Promise<SendKakaoSignupAlimtalkResult> {
  const receiver = normalizeReceiverPhone(input.phone ?? "");
  if (!receiver) {
    return { ok: false, skipped: "empty_phone" };
  }

  const env = readSignupEnv();
  if (!env.messageTemplate.trim()) {
    return { ok: false, skipped: "missing_message_env" };
  }
  if (!env.subject) {
    return { ok: false, skipped: "missing_subject_env" };
  }

  const customerName = resolveCustomerName(input.customerName);
  const message = replaceCustomerNamePlaceholder(env.messageTemplate, customerName);

  try {
    await sendAlimtalkRelay({
      receiver,
      recvname: customerName,
      tpl_code: env.tplCode,
      subject: env.subject,
      message,
      button: env.button,
      failover: env.failover,
      fsubject: env.failover === "Y" ? env.fsubject : undefined,
      fmessage: env.failover === "Y" ? env.fmessage : undefined,
      testMode: env.testMode,
    });
    return { ok: true };
  } catch (error) {
    console.error("[kakaoSignupAlimtalk] send failed", error);
    return { ok: false, error };
  }
}
