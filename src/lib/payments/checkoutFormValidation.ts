/** 간편 주문서 필드 검증 */

export type CheckoutFormValues = {
  name: string;
  phone: string;
  email: string;
  specialRequest: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeRefund: boolean;
};

export type CheckoutFormErrors = Partial<Record<keyof CheckoutFormValues, string>>;

/** 숫자만 남긴 뒤 010-XXXX-XXXX 형태로 표시 */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isValidCheckoutPhone(phone: string): boolean {
  const d = normalizePhoneDigits(phone);
  return /^01[016789]\d{7,8}$/.test(d);
}

export function isValidCheckoutEmail(email: string): boolean {
  const v = email.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function validateCheckoutForm(values: CheckoutFormValues): CheckoutFormErrors {
  const errors: CheckoutFormErrors = {};
  if (!values.name.trim()) {
    errors.name = "성함을 입력해 주세요.";
  }
  if (!isValidCheckoutPhone(values.phone)) {
    errors.phone = "올바른 휴대폰 번호를 입력해 주세요.";
  }
  if (!isValidCheckoutEmail(values.email)) {
    errors.email = "올바른 이메일을 입력해 주세요.";
  }
  if (!values.agreeTerms) {
    errors.agreeTerms = "여행 표준약관에 동의해 주세요.";
  }
  if (!values.agreePrivacy) {
    errors.agreePrivacy = "개인정보 수집·이용에 동의해 주세요.";
  }
  if (!values.agreeRefund) {
    errors.agreeRefund = "취소·환불 규정을 확인해 주세요.";
  }
  return errors;
}

export function firstCheckoutFormErrorKey(
  errors: CheckoutFormErrors,
): keyof CheckoutFormValues | null {
  const order: (keyof CheckoutFormValues)[] = [
    "name",
    "phone",
    "email",
    "agreeTerms",
    "agreePrivacy",
    "agreeRefund",
  ];
  for (const key of order) {
    if (errors[key]) return key;
  }
  return null;
}
