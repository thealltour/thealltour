import {
  deriveLegacyFieldsFromBodyDoc,
  deriveStyleConfigFromBodyDoc,
  extractPlainTextFromBodyDoc,
  isBodyDocEmpty,
  parseMobileGolfAdBodyDoc,
  type MobileGolfAdBodyDoc,
} from "@/lib/adminMobileGolfAds/bodyDoc";
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

export function normalizeMobileGolfAdBodyDoc(raw: MobileGolfAdBodyDoc | unknown): MobileGolfAdBodyDoc {
  return parseMobileGolfAdBodyDoc(raw);
}

export function validateMobileGolfAdInput(input: MobileGolfAdLandingInput): MobileGolfAdLandingInput {
  const title = input.title?.trim() ?? "";
  const slug = normalizeMobileGolfAdSlug(input.slug ?? "");
  const heroImageUrl = input.heroImageUrl?.trim() ?? "";
  const bodyDoc = normalizeMobileGolfAdBodyDoc(input.bodyDoc);

  if (!title) throw new MobileGolfAdValidationError("제목을 입력해 주세요.");
  if (!slug || !SLUG_RE.test(slug)) {
    throw new MobileGolfAdValidationError("slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
  }
  if (!heroImageUrl) throw new MobileGolfAdValidationError("히어로 이미지를 업로드해 주세요.");

  const plainText = extractPlainTextFromBodyDoc(bodyDoc).trim();
  const hasProductRail = bodyDoc.content.some((b) => b.type === "golfProductRail");
  if (isBodyDocEmpty(bodyDoc) && !hasProductRail) {
    throw new MobileGolfAdValidationError("본문 내용을 입력해 주세요.");
  }
  if (!plainText && !hasProductRail) {
    throw new MobileGolfAdValidationError("본문 텍스트 또는 상품 진열대를 추가해 주세요.");
  }

  return {
    title,
    slug,
    heroImageUrl,
    bodyDoc,
    seoTitle: input.seoTitle?.trim() || null,
    seoDescription: input.seoDescription?.trim() || null,
  };
}

export function validateMobileGolfAdForPublish(input: MobileGolfAdLandingInput): void {
  validateMobileGolfAdInput(input);
}

export function buildLegacyDbFieldsFromInput(input: MobileGolfAdLandingInput) {
  const bodyDoc = normalizeMobileGolfAdBodyDoc(input.bodyDoc);
  const legacy = deriveLegacyFieldsFromBodyDoc(bodyDoc);
  const styleConfig = deriveStyleConfigFromBodyDoc(bodyDoc);
  return {
    benefit_text: legacy.benefitText,
    trust_action_text: legacy.trustActionText,
    style_config: styleConfig,
    body_doc: bodyDoc,
  };
}
