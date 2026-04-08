import type { Product } from "@/types/product";
import type { ResolvedProductNoticesForDetail } from "@/lib/noticeTemplates";
import { mapProductToSmartstoreHtmlViewModel } from "@/lib/smartstore/mapProductToSmartstoreHtmlViewModel";
import type { SmartstoreHtmlViewModel, SmartstoreHtmlBuildMeta } from "@/lib/smartstore/smartstoreHtml.types";
import {
  buildAllSectionsHtml,
  buildGallerySection,
  buildHeroSection,
  buildListSection,
  buildScheduleSection,
  buildSummarySection,
} from "@/lib/smartstore/buildSmartstoreDetailSections";
import { SMARTSTORE_SECTION_TITLES } from "@/lib/smartstore/smartstoreHtml.defaults";
import { styleAttr } from "@/lib/smartstore/smartstoreHtml.helpers";
import {
  analyzeSmartstoreHtml,
  assertSmartstoreHtmlBuildSafe,
  type SmartstoreHtmlSafetyReport,
} from "@/lib/smartstore/smartstoreHtml.safety";

function collectMeta(
  vm: SmartstoreHtmlViewModel,
  html: string,
  safety: SmartstoreHtmlSafetyReport,
): SmartstoreHtmlBuildMeta {
  const includedSections: string[] = [];
  if (buildHeroSection(vm).used) includedSections.push("대표 비주얼");
  includedSections.push("상품명", "한 줄 요약");
  if (buildSummarySection(vm).used) includedSections.push("기본 정보 요약");
  const gal = buildGallerySection(vm);
  if (gal.count > 0) includedSections.push("추가 이미지");
  if (buildListSection(SMARTSTORE_SECTION_TITLES.included, vm.includedLines).used) {
    includedSections.push("포함 사항");
  }
  if (buildListSection(SMARTSTORE_SECTION_TITLES.excluded, vm.excludedLines).used) {
    includedSections.push("불포함 사항");
  }
  const hasOptional = buildListSection(SMARTSTORE_SECTION_TITLES.optional, vm.optionalLines).used;
  if (hasOptional) includedSections.push("선택 관광");
  const sched = buildScheduleSection(vm);
  if (sched.used) includedSections.push("일정 안내");
  includedSections.push(
    "예약 조건",
    "예약 시 유의사항",
    "여행 시 유의사항",
    "환불·취소 규정",
    "상담 안내",
  );

  const hasStructuredTimeline = Boolean(vm.timeline && vm.timeline.days.length > 0);

  return {
    title: vm.title,
    productId: vm.productId,
    characterCount: html.length,
    imageCount: safety.httpsImageCount,
    includedSections,
    hasHeroImage: Boolean(vm.heroImageUrl),
    hasTimeline: hasStructuredTimeline || sched.used,
    hasIncludedExcluded: vm.includedLines.length > 0 || vm.excludedLines.length > 0,
    hasOptionalTours: hasOptional,
    hasNoticesBlock: true,
    safety,
  };
}

/**
 * ViewModel → 스마트스토어 붙여넣기용 self-contained HTML (외부 CSS/JS·링크 없음)
 */
export function buildSmartstoreDetailHtml(vm: SmartstoreHtmlViewModel): {
  html: string;
  meta: SmartstoreHtmlBuildMeta;
} {
  const inner = buildAllSectionsHtml(vm);
  const wrapStyles = {
    width: "100%",
    "max-width": "860px",
    margin: "0 auto",
    padding: "16px 12px",
    "box-sizing": "border-box",
    "font-family":
      "-apple-system,BlinkMacSystemFont,'Malgun Gothic','Segoe UI',Roboto,sans-serif",
    color: "#334155",
    "font-size": "15px",
    "line-height": "1.65",
    "word-break": "break-word",
  };
  const html = `<div id="smartstore-theall-detail"${styleAttr(wrapStyles)}>${inner}</div>`;
  const safety = analyzeSmartstoreHtml(html);
  assertSmartstoreHtmlBuildSafe(html);
  return { html, meta: collectMeta(vm, html, safety) };
}

/** Product + 공지 해석 결과 → HTML (서버 API·테스트용) */
export function buildSmartstoreDetailHtmlFromProduct(
  product: Product,
  notices: ResolvedProductNoticesForDetail,
): { html: string; meta: SmartstoreHtmlBuildMeta } {
  const vm = mapProductToSmartstoreHtmlViewModel(product, notices);
  return buildSmartstoreDetailHtml(vm);
}
