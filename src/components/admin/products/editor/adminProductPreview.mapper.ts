/**
 * Admin product form → 미리보기용 Product 변환
 * 우측 미리보기 패널이 기대하는 shape 유지
 */

import type { Product } from "@/types/product";
import type { ProductFormState } from "@/types/adminProductForm";
import { formToPreviewProduct } from "@/lib/admin/productPreview";
import {
  hasRealText,
  hasValidNumber,
  hasAnyValidSeasonalPriceBand,
  hasValidPriceOptionJson,
  hasCoverImage,
  hasNonEmptyArray,
} from "@/lib/products/formCompletion";
import { parseDetailedSchedule } from "./adminProductForm.helpers";

/**
 * 폼 상태를 미리보기용 Product로 변환.
 * imageUrlForPreview: 로컬 선택 이미지 등 대체 URL
 */
export function mapAdminProductFormToPreviewProduct(
  form: ProductFormState,
  imageUrlForPreview: string,
): Product {
  return formToPreviewProduct(form, imageUrlForPreview);
}

export type PreviewWarning = {
  id: string;
  message: string;
  sectionId: "basic" | "taxonomy" | "schedule";
};

/** 미리보기 품질 경고: 원인 + 화면 영향. sectionId는 클릭 시 해당 아코디언 열기/스크롤용 */
export function getPreviewWarnings(
  form: ProductFormState,
  hasPreviewImage: boolean,
): PreviewWarning[] {
  const warnings: PreviewWarning[] = [];

  if (!hasRealText(form.category)) {
    warnings.push({
      id: "category",
      message: "카테고리 미입력 → 카드/상세에 카테고리 칩이 비어 보입니다.",
      sectionId: "taxonomy",
    });
  }

  if (
    !hasValidNumber(form.price) &&
    !hasAnyValidSeasonalPriceBand(form) &&
    !hasValidPriceOptionJson(form.options_json)
  ) {
    warnings.push({
      id: "price",
      message: "가격 미입력 또는 0원 → 카드/상세에 '상담 후 견적'으로만 표시됩니다.",
      sectionId: "basic",
    });
  }

  if (!hasCoverImage(form.image_url, form.images_json) && !hasPreviewImage) {
    warnings.push({
      id: "image",
      message: "대표 이미지 없음 → 카드/상세에 이미지가 비어 보입니다.",
      sectionId: "basic",
    });
  }

  const scheduleDrafts = parseDetailedSchedule(form.detailed_schedule);
  const hasEmptySchedule =
    !hasNonEmptyArray(form.itinerary_days_json) &&
    (!hasNonEmptyArray(scheduleDrafts) || scheduleDrafts.every((d) => !hasRealText(d.content)));
  if (hasEmptySchedule) {
    warnings.push({
      id: "schedule",
      message: "일정(일차) 비어 있음 → 상세 '일정 안내' 탭에 내용이 없습니다.",
      sectionId: "schedule",
    });
  }

  return warnings;
}
