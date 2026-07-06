import type { MobileGolfAdLandingInput } from "@/lib/adminMobileGolfAds/types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class MobileGolfAdValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MobileGolfAdValidationError";
  }
}

export function normalizeMobileGolfAdSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateMobileGolfAdInput(input: MobileGolfAdLandingInput): MobileGolfAdLandingInput {
  const title = input.title?.trim() ?? "";
  const slug = normalizeMobileGolfAdSlug(input.slug ?? "");
  const heroImageUrl = input.heroImageUrl?.trim() ?? "";
  const benefitText = input.benefitText?.trim() ?? "";
  const trustActionText = input.trustActionText?.trim() ?? "";

  if (!title) throw new MobileGolfAdValidationError("제목을 입력해 주세요.");
  if (!slug || !SLUG_RE.test(slug)) {
    throw new MobileGolfAdValidationError("slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
  }
  if (!heroImageUrl) throw new MobileGolfAdValidationError("히어로 이미지를 업로드해 주세요.");
  if (!benefitText) throw new MobileGolfAdValidationError("Benefit Section 텍스트를 입력해 주세요.");
  if (!trustActionText) {
    throw new MobileGolfAdValidationError("Trust & Action Section 텍스트를 입력해 주세요.");
  }

  return {
    title,
    slug,
    heroImageUrl,
    benefitText,
    trustActionText,
    seoTitle: input.seoTitle?.trim() || null,
    seoDescription: input.seoDescription?.trim() || null,
  };
}

export function validateMobileGolfAdForPublish(input: MobileGolfAdLandingInput): void {
  validateMobileGolfAdInput(input);
}
