import type { FirstTouch } from "@/types/inquiry";

export type GolfUtmLeadInput = {
  customerName: string;
  phoneNumber: string;
  groupSize?: number | null;
  targetDestination?: string | null;
  landingPage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
};

export type InquiryToGolfLeadInput = {
  name: string;
  phone: string;
  content?: string | null;
  productTitle?: string | null;
  sourcePath?: string | null;
  landingSlug?: string | null;
  quoteCategory?: string | null;
  inquiryPageUrl?: string | null;
  firstTouch?: FirstTouch | null;
  peopleCount?: string | null;
};

/** 문의 본문 "인원: N" 또는 숫자 문자열에서 group_size 추출 */
export function parseGroupSizeFromContent(content?: string | null, peopleCount?: string | null): number | null {
  const direct = peopleCount?.trim();
  if (direct) {
    const n = Number.parseInt(direct.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (!content?.trim()) return null;
  const match = content.match(/인원\s*[:：]?\s*(\d+)/i);
  if (!match?.[1]) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pickLandingPage(input: InquiryToGolfLeadInput): string | null {
  const ftUrl = input.firstTouch?.firstLandingUrl?.trim();
  if (ftUrl) return ftUrl;
  const source = input.sourcePath?.trim();
  if (source) return source;
  const page = input.inquiryPageUrl?.trim();
  if (page) return page;
  if (input.landingSlug?.trim()) return `/recommended/${input.landingSlug.trim()}`;
  return null;
}

function pickTargetDestination(input: InquiryToGolfLeadInput): string | null {
  const product = input.productTitle?.trim();
  if (product) return product;
  const category = input.quoteCategory?.trim();
  if (category) return category;
  const slug = input.landingSlug?.trim();
  if (slug) return slug;
  return null;
}

/** /api/inquiries body → golf_tour_leads insert payload */
export function buildGolfUtmLeadFromInquiry(input: InquiryToGolfLeadInput): GolfUtmLeadInput {
  const ft = input.firstTouch ?? null;
  return {
    customerName: input.name.trim(),
    phoneNumber: input.phone.trim(),
    groupSize: parseGroupSizeFromContent(input.content, input.peopleCount),
    targetDestination: pickTargetDestination(input),
    landingPage: pickLandingPage(input),
    utmSource: ft?.utm_source?.trim() || null,
    utmMedium: ft?.utm_medium?.trim() || null,
    utmCampaign: ft?.utm_campaign?.trim() || null,
    utmTerm: ft?.utm_term?.trim() || null,
    utmContent: ft?.utm_content?.trim() || null,
  };
}
