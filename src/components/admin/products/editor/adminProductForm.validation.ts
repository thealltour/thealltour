/**
 * Admin product form - 섹션별 검증 및 저장 전 필수 이슈 수집
 */

import type { ProductFormState } from "@/types/adminProductForm";
import {
  hasRealText,
  hasValidNumber,
  hasAnyValidSeasonalPriceBand,
  hasValidPriceOptionJson,
  hasCoverImage,
  hasNonEmptyArray,
} from "@/lib/products/formCompletion";
import { parseDetailedSchedule } from "./adminProductForm.helpers";
import type { SectionConfig, SectionIssue, FormIssue } from "./adminProductForm.types";

function hasValidPriceOption(form: ProductFormState): boolean {
  return hasValidPriceOptionJson(form.options_json);
}

export const SECTIONS: SectionConfig[] = [
  {
    id: "basic",
    title: "핵심",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      if (!hasRealText(form.title)) {
        issues.push({
          sectionId: "basic",
          fieldKey: "title",
          message: "상품명을 입력해 주세요.",
          anchorId: "field-product-name",
          severity: "required",
        });
      }
      if (!hasCoverImage(form.image_url, form.images_json ?? [])) {
        issues.push({
          sectionId: "basic",
          fieldKey: "image",
          message: "대표 이미지를 1장 이상 등록해 주세요.",
          anchorId: "field-product-cover-image",
          severity: "required",
        });
      }
      if (!hasRealText(form.one_liner)) {
        issues.push({
          sectionId: "basic",
          fieldKey: "one_liner",
          message: "한 줄 소개를 입력하면 상세 상단에 표시됩니다.",
          anchorId: "form-field-basic-one_liner",
          severity: "recommended",
        });
      }
      const hasValidPrice = hasValidNumber(form.price);
      const hasOptions = hasValidPriceOption(form);
      const hasSeasonal = hasAnyValidSeasonalPriceBand(form);
      const seasonalFields: Array<{
        key: keyof ProductFormState["seasonal_price_bands"];
        label: string;
        anchorId: string;
      }> = [
        { key: "offSeason", label: "비수기", anchorId: "field-seasonal-off" },
        { key: "weekend", label: "주말", anchorId: "field-seasonal-weekend" },
        { key: "peakSeason", label: "성수기", anchorId: "field-seasonal-peak" },
      ];
      for (const { key, label, anchorId } of seasonalFields) {
        const raw = form.seasonal_price_bands[key];
        if (hasRealText(raw) && !hasValidNumber(raw)) {
          issues.push({
            sectionId: "basic",
            fieldKey: `seasonal_${key}`,
            message: `${label} 가격은 0보다 큰 숫자여야 합니다.`,
            anchorId,
            severity: "required",
          });
        }
      }
      if (!hasValidPrice && !hasOptions && !hasSeasonal) {
        issues.push({
          sectionId: "basic",
          fieldKey: "price",
          message: "가격(숫자), 가격 구간(비수기·주말·성수기) 중 하나, 또는 가격 옵션 JSON을 등록해 주세요.",
          anchorId: "field-price-main",
          severity: "required",
        });
      }
      return issues;
    },
  },
  {
    id: "taxonomy",
    title: "분류",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      if (!hasRealText(form.destination_id) && !hasRealText(form.category)) {
        issues.push({
          sectionId: "taxonomy",
          fieldKey: "destination_id",
          message: "지역(분류)을 선택해 주세요.",
          anchorId: "form-field-taxonomy-category",
          severity: "recommended",
        });
      }
      if (!hasRealText(form.theme)) {
        issues.push({
          sectionId: "taxonomy",
          fieldKey: "theme",
          message: "테마를 선택하면 노출 품질이 좋아집니다.",
          anchorId: "form-field-taxonomy-theme",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
  {
    id: "travel",
    title: "여행 정보",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      const hasIncluded = hasRealText(form.included_items);
      const hasExcluded = hasRealText(form.excluded_items);
      const hasOptional = hasRealText(form.optional_tours);
      if (!hasIncluded && !hasExcluded && !hasOptional) {
        issues.push({
          sectionId: "travel",
          fieldKey: "included",
          message: "포함·불포함·선택관광 중 최소 1개 이상 입력을 권장합니다.",
          anchorId: "field-included",
          severity: "recommended",
        });
      }
      const dep = hasRealText(form.departure_flight_name) ? form.departure_flight_name!.trim() : "";
      const arr = hasRealText(form.arrival_flight_name) ? form.arrival_flight_name!.trim() : "";
      if (dep && !/^[A-Z0-9]{2}\s*\d+/i.test(dep.replace(/\s/g, ""))) {
        issues.push({
          sectionId: "travel",
          fieldKey: "departure_flight_name",
          message: "출발 편명 형식(예: OZ 123)을 권장합니다.",
          anchorId: "form-field-flight-departure_flight_name",
          severity: "recommended",
        });
      }
      if (arr && !/^[A-Z0-9]{2}\s*\d+/i.test(arr.replace(/\s/g, ""))) {
        issues.push({
          sectionId: "travel",
          fieldKey: "arrival_flight_name",
          message: "도착 편명 형식(예: OZ 456)을 권장합니다.",
          anchorId: "form-field-flight-arrival_flight_name",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
  {
    id: "schedule",
    title: "일정",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      const v2Days = form.itinerary_v2_json?.days ?? [];
      const structuredDays = form.itinerary_days_json ?? [];
      const scheduleDrafts = parseDetailedSchedule(form.detailed_schedule ?? "");
      const hasV2 = hasNonEmptyArray(v2Days);
      const hasStructured = hasNonEmptyArray(structuredDays);
      const hasLegacyContent =
        hasNonEmptyArray(scheduleDrafts) &&
        scheduleDrafts.some((d) => hasRealText(d.content));
      const hasAnySchedule = hasV2 || hasStructured || hasLegacyContent;
      if (!hasAnySchedule) {
        issues.push({
          sectionId: "schedule",
          fieldKey: "schedule",
          message: "일정(일차)을 최소 1일 이상 입력해 주세요.",
          anchorId: "field-schedule-root",
          severity: "required",
        });
      } else if (hasV2) {
        const emptyDays = v2Days.filter((d) => {
          const hasTitle = hasRealText(d.title) || hasRealText(d.dateText);
          const events = d.events ?? [];
          const hasEvent = events.some(
            (e) => hasRealText(e.heading) || hasRealText(e.description),
          );
          return !hasTitle && !hasEvent;
        });
        if (emptyDays.length > 0) {
          issues.push({
            sectionId: "schedule",
            fieldKey: "schedule_day",
            message: "일부 일차에 제목·날짜 또는 이벤트를 입력해 주세요.",
            anchorId: "field-schedule-root",
            severity: "recommended",
          });
        }
      }
      return issues;
    },
  },
  {
    id: "ops",
    title: "운영·SEO",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      if (!hasRealText(form.meta_title)) {
        issues.push({
          sectionId: "ops",
          fieldKey: "meta_title",
          message: "SEO 메타 제목을 입력하면 검색 노출에 유리합니다.",
          anchorId: "field-seo-title",
          severity: "recommended",
        });
      }
      if (!hasRealText(form.meta_description)) {
        issues.push({
          sectionId: "ops",
          fieldKey: "meta_description",
          message: "SEO 메타 설명을 입력하면 검색 노출에 유리합니다.",
          anchorId: "field-seo-desc",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
  {
    id: "advanced",
    title: "고급 설정",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      if (!hasRealText(form.description)) {
        issues.push({
          sectionId: "advanced",
          fieldKey: "description",
          message: "상품 설명을 입력하면 상세 페이지 노출에 유리합니다.",
          anchorId: "field-product-description",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
];

/** 필수(required) 이슈만 섹션 순서대로 수집. 저장 전 검증 및 스크롤/포커스용 */
export function collectAllRequiredIssues(form: ProductFormState): SectionIssue[] {
  const out: SectionIssue[] = [];
  for (const section of SECTIONS) {
    const issues = section.getIssues(form).filter((i) => i.severity === "required");
    out.push(...issues);
  }
  return out;
}

/** 섹션별 이슈 전체 수집(required + recommended). 뱃지/저장 실패 점프 재사용 */
export function collectFormIssues(form: ProductFormState): FormIssue[] {
  const out: FormIssue[] = [];
  for (const section of SECTIONS) {
    out.push(...section.getIssues(form));
  }
  return out;
}
