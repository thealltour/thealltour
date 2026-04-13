/**
 * 관리자 화면용 문자 길이·SMS/LMS 구분 (실무 확인용, 과금/사업자 단가와 일치하지 않을 수 있음).
 *
 * 기준: 본문을 UTF-8으로 인코딩한 바이트 길이.
 * - 90바이트 이하: 단문(SMS)에 가까운 길이로 표시
 * - 초과: 장문(LMS)으로 표시
 *
 * 공백: 판정·표시는 trim한 문자열 기준(빈 문자열이면 SMS로 분류하되 warning 처리는 호출부).
 */
export type SmsLengthKind = "SMS" | "LMS";

export type SmsLengthInfo = {
  rawLength: number;
  effectiveLength: number;
  utf8Bytes: number;
  kind: SmsLengthKind;
  remaining: number | null;
  warning: string | null;
};

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

const SMS_BYTE_LIMIT = 90;
/** LMS 상한은 사업자별 상이하나, UI 경고용 상한(바이트) */
const LMS_SOFT_WARN_BYTES = 2000;

export function getSmsLengthInfo(text: string): SmsLengthInfo {
  const trimmed = text.replace(/\u00a0/g, " ").trimEnd();
  const rawLength = text.length;
  const effectiveLength = trimmed.length;
  const utf8Bytes = utf8ByteLength(trimmed);
  const kind: SmsLengthKind = utf8Bytes <= SMS_BYTE_LIMIT && effectiveLength > 0 ? "SMS" : effectiveLength === 0 ? "SMS" : "LMS";

  let remaining: number | null = null;
  let warning: string | null = null;

  if (effectiveLength === 0) {
    warning = "내용이 비어 있습니다.";
  } else if (kind === "SMS") {
    remaining = Math.max(0, SMS_BYTE_LIMIT - utf8Bytes);
    if (remaining <= 10 && remaining >= 0) {
      warning = "단문(SMS) 길이 한도에 가깝습니다.";
    }
  } else {
    remaining = null;
    if (utf8Bytes > LMS_SOFT_WARN_BYTES) {
      warning = "매우 긴 장문입니다. 수신/중계 정책에 따라 분할·실패할 수 있습니다.";
    } else if (utf8Bytes > SMS_BYTE_LIMIT) {
      warning = "단문 한도를 넘어 장문(LMS)으로 표시됩니다.";
    }
  }

  return {
    rawLength,
    effectiveLength,
    utf8Bytes,
    kind,
    remaining,
    warning,
  };
}
