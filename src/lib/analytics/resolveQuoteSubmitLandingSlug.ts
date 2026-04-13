import { landingSlugFromSourcePath } from "@/lib/analytics/createAnalyticsPayload";
import { extractPathFromLandingUrl } from "@/lib/analytics/attribution";
import type { FirstTouch } from "@/types/inquiry";

function slugFromPagePathCandidate(raw: string | null | undefined): string | null {
  const page = raw?.trim();
  if (!page) return null;
  if (page.startsWith("/")) {
    return landingSlugFromSourcePath(page);
  }
  if (/^https?:\/\//i.test(page)) {
    try {
      return landingSlugFromSourcePath(new URL(page).pathname);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 문의(quote) 제출 시 quote_submit 이벤트에 넣을 landing slug 후보를 순서대로 해석한다.
 * body.landing_slug → source_path(/recommended 또는 URL) → first_touch.firstLandingUrl → inquiry_page_url
 */
export function resolveQuoteSubmitLandingSlug(input: {
  landingSlug?: string | null;
  sourcePath?: string | null;
  firstTouch?: FirstTouch | null;
  inquiryPageUrl?: string | null;
}): string | null {
  const direct = input.landingSlug?.trim();
  if (direct) return direct;

  const fromSource = landingSlugFromSourcePath(input.sourcePath);
  if (fromSource) return fromSource;

  const firstPath = extractPathFromLandingUrl(input.firstTouch?.firstLandingUrl);
  if (firstPath) {
    const fromFirstTouch = landingSlugFromSourcePath(firstPath);
    if (fromFirstTouch) return fromFirstTouch;
  }

  return slugFromPagePathCandidate(input.inquiryPageUrl);
}
