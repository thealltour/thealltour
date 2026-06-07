import "server-only";

import { buildGolfUtmLeadFromInquiry } from "@/lib/leads/golfLeadPayload";
import { isGolfLeadContext } from "@/lib/leads/golfLeadContext";
import { persistGolfUtmLead } from "@/lib/leads/persistGolfUtmLead";
import type { FirstTouch } from "@/types/inquiry";

export type GolfLeadInquiryDualWriteInput = {
  name: string;
  phone: string;
  content?: string | null;
  productTitle?: string | null;
  sourcePath?: string | null;
  landingSlug?: string | null;
  quoteCategory?: string | null;
  inquiryPageUrl?: string | null;
  firstTouch?: FirstTouch | null;
};

/**
 * 문의 저장 성공 후 골프 컨텍스트면 golf_tour_leads에 dual-write.
 * fire-and-forget — await 하지 않고 void로 호출.
 */
export function dualWriteGolfLeadFromInquiry(input: GolfLeadInquiryDualWriteInput): void {
  const golfContext = isGolfLeadContext({
    landingSlug: input.landingSlug,
    quoteCategory: input.quoteCategory,
    sourcePath: input.sourcePath,
    productTitle: input.productTitle,
    inquiryPageUrl: input.inquiryPageUrl,
    content: input.content,
    firstTouch: input.firstTouch,
  });

  if (!golfContext) return;

  const payload = buildGolfUtmLeadFromInquiry({
    name: input.name,
    phone: input.phone,
    content: input.content,
    productTitle: input.productTitle,
    sourcePath: input.sourcePath,
    landingSlug: input.landingSlug,
    quoteCategory: input.quoteCategory,
    inquiryPageUrl: input.inquiryPageUrl,
    firstTouch: input.firstTouch,
  });

  void persistGolfUtmLead(payload).then((result) => {
    if (!result.ok) {
      console.error("[inquiries] golf lead dual-write failed", result.error);
    }
  });
}
