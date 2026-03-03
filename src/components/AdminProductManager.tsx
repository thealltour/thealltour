"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, AlertCircle } from "lucide-react";
import { ProductFormSectionIssuesPanel } from "@/components/admin/ProductFormSectionIssuesPanel";
import { AirlineLogo } from "@/components/airlines/AirlineLogo";
import type { Product, ItineraryStructuredDay, ItineraryV2, SelectedEventRef } from "@/types/product";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { useAdminConfirm } from "@/components/admin/AdminConfirmProvider";
import ProductCardV2, { type ProductCardV2Props } from "@/components/products/ProductCardV2";
import ProductDetailV2, { type ProductDetailV2StatusTag } from "@/components/products/ProductDetailV2";
import {
  ProductDetailStickyV2Desktop,
  ProductDetailStickyV2Mobile,
} from "@/components/products/ProductDetailStickyV2";
import { ConsultModalProvider } from "@/components/ConsultModal";
import { ProductQuoteProvider } from "@/components/products/ProductQuoteContext";
import { Tabs, TabsTrigger } from "@/components/ui/Tabs";
import {
  formToPreviewProduct,
  productToCardV2PropsPayload,
  productToDetailV2PropsPayload,
} from "@/lib/admin/productPreview";
import {
  getTimelineModelFromSchedule,
  timelineModelToStructuredDays,
  serializeStructuredDaysToSchedule,
  itineraryV2ToTimelineModel,
} from "@/lib/products/mapProductToTimelineModel";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { MultiImageUploadField } from "@/components/admin/MultiImageUploadField";
import { InteractiveTimelineV2 } from "@/components/products/InteractiveTimelineV2";
import { ScheduleVisualEditorV2 } from "@/components/admin/ScheduleVisualEditorV2";
import { StructuredDaysEditor } from "@/components/admin/itinerary/structured/StructuredDaysEditor";
import { normalizeAirline } from "@/lib/airlines/normalizeAirline";
import { AIRLINE_LOGO_BY_CODE } from "@/lib/airlines/airlineLogos";
import { normalizeImageList } from "@/lib/products/images";
import {
  hasRealText,
  hasValidNumber,
  hasValidPriceOptionJson,
  hasCoverImage,
  hasNonEmptyArray,
} from "@/lib/products/formCompletion";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { BOOKMARKLET_EXTRACT_IMAGE_URLS } from "@/lib/bookmarkletExtractImageUrls";
import { ImageImportGuideModal } from "@/components/admin/ImageImportGuideModal";
import { parsePastedImageUrls } from "@/lib/admin/parsePastedImageUrls";
import { ProductFormActionBar } from "@/components/admin/ProductFormActionBar";
import { ProductFormSectionNav } from "@/components/admin/ProductFormSectionNav";
import { extractTitleCandidates } from "@/lib/products/extractProductTitle";
import {
  recommendCoverCandidates,
  type CoverCandidate,
} from "@/lib/products/recommendCoverImage";

function normalizeUrlForCompare(url: string): string {
  return url.trim();
}

type ProductFormState = {
  title: string;
  description: string;
  product_source_url: string;
  point_benefits: string;
  point_tourism: "O" | "X";
  point_guide: "O" | "X";
  meeting_info: "O" | "X";
  travel_insurance: "O" | "X";
  included_items: string;
  excluded_items: string;
  departure_from_airport: string;
  departure_from_date: string;
  departure_from_time: string;
  departure_to_airport: string;
  departure_to_date: string;
  departure_to_time: string;
  departure_flight_name: string;
  departure_baggage_limit: string;
  arrival_from_airport: string;
  arrival_from_date: string;
  arrival_from_time: string;
  arrival_to_airport: string;
  arrival_to_date: string;
  arrival_to_time: string;
  arrival_flight_name: string;
  arrival_baggage_limit: string;
  detailed_schedule: string;
  optional_tours: string;
  min_departure_people: string;
  terms_template_type: "" | TermsTemplateType;
  terms_and_notes: string;
  meta_title: string;
  meta_description: string;
  image_url: string;
  images_json: string[];
  category: string;
  theme: string;
  price: string;
  duration: string;
  itinerary: string;
  inclusions: string;
  is_active: boolean;
  is_featured_home: boolean;
  sort_order: string;
  /** 예약 가능 / 잔여 한정 / 마감 / 상담 후 안내 */
  status: "" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  one_liner: string;
  price_meta: string;
  /** "" = 표시 안 함, "true" = 포함, "false" = 별도 */
  fuel_included: "" | "true" | "false";
  meta_info: string;
  /** JSON 문자열. 옵션 사용 시 ProductOptions 직렬화 */
  options_json: string;
  /** [STEP 3] 일정 Day별 대표 이미지 URL. 키: "1","2",... 값: URL */
  itinerary_media_json: Record<string, string>;
  /** [STEP 0] 구조화 일정. 있으면 상세에서 시각화 타임라인 우선 사용 */
  itinerary_days_json: ItineraryStructuredDay[];
  /** [STEP 1] 시각화 일정 v2 (jsonb 1컬럼, 권장) */
  itinerary_v2_json: ItineraryV2;
  /** [STEP 3] 레거시 텍스트 붙여넣기용 (저장 안 함, 초안 생성용) */
  legacy_itinerary_text: string;
  /** 일정 테마 구성비. 상세 오버뷰 차트용. 2개 이상 입력 시 저장 */
  theme_chart_json: Array<{ label: string; percent: number }>;
  /** 여행 오버뷰 카드 전용 (숙소·지역·기간) */
  overview_accommodation: string;
  overview_region: string;
  overview_duration: string;
};

type ToastState = {
  type: "success" | "error";
  text: string;
} | null;

const FEATURED_PRODUCT_LIMIT = 8;

/** 임시저장 localStorage 키 접두사 (뒤에 productId or 'new' 붙임) */
const PRODUCT_FORM_DRAFT_KEY_PREFIX = "admin_product_form_draft_v1:";

function getDraftKey(productId: string | null): string {
  return PRODUCT_FORM_DRAFT_KEY_PREFIX + (productId ?? "new");
}

/** 임시저장 payload (로컬 저장/복원용) */
export type ProductFormDraft = {
  version: 1;
  form: ProductFormState;
  savedAt: number;
};

const TERMS_TEMPLATE_OPTIONS = [
  { value: "overseas_brokerage", label: "해외중개" },
  { value: "domestic_brokerage", label: "국내중개" },
  { value: "overseas_direct", label: "해외직접" },
  { value: "domestic_direct", label: "국내직접" },
] as const;

type TermsTemplateType = (typeof TERMS_TEMPLATE_OPTIONS)[number]["value"];
type TermsTemplateMap = Record<TermsTemplateType, string>;
type ProductSortKey = "title" | "category" | "price" | "sort_order" | "created_at";

function createEmptyTermsTemplateMap(): TermsTemplateMap {
  return {
    overseas_brokerage: "",
    domestic_brokerage: "",
    overseas_direct: "",
    domestic_direct: "",
  };
}

const initialFormState: ProductFormState = {
  title: "",
  description: "",
  product_source_url: "",
  point_benefits: "",
  point_tourism: "X",
  point_guide: "X",
  meeting_info: "X",
  travel_insurance: "X",
  included_items: "",
  excluded_items: "",
  departure_from_airport: "",
  departure_from_date: "",
  departure_from_time: "",
  departure_to_airport: "",
  departure_to_date: "",
  departure_to_time: "",
  departure_flight_name: "",
  departure_baggage_limit: "",
  arrival_from_airport: "",
  arrival_from_date: "",
  arrival_from_time: "",
  arrival_to_airport: "",
  arrival_to_date: "",
  arrival_to_time: "",
  arrival_flight_name: "",
  arrival_baggage_limit: "",
  detailed_schedule: "",
  optional_tours: "",
  min_departure_people: "",
  terms_template_type: "",
  terms_and_notes: "",
  meta_title: "",
  meta_description: "",
  image_url: "",
  images_json: [],
  category: "여행상품",
  theme: "",
  price: "",
  duration: "",
  itinerary: "",
  inclusions: "",
  is_active: true,
  is_featured_home: false,
  sort_order: "",
  status: "AVAILABLE",
  one_liner: "",
  price_meta: "",
  fuel_included: "",
  meta_info: "",
  options_json: "",
  itinerary_media_json: {},
  itinerary_days_json: [],
  itinerary_v2_json: { days: [] },
  legacy_itinerary_text: "",
  theme_chart_json: [],
  overview_accommodation: "",
  overview_region: "",
  overview_duration: "",
};

function normalizeOXValue(value?: string | null): "O" | "X" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "X";
  if (["o", "y", "yes", "예", "가능", "제공", "포함", "있음", "있다"].includes(normalized)) return "O";
  if (["x", "n", "no", "아니오", "불가", "미제공", "불포함", "없음", "없다"].includes(normalized)) return "X";
  if (normalized.includes("없") || normalized.includes("불가") || normalized.includes("미")) return "X";
  return "O";
}

function formatPriceWithCommas(raw: string) {
  const hasTilde = raw.includes("~");
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) return "";
  const formatted = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return hasTilde ? `${formatted}~` : formatted;
}

type DayScheduleDraft = {
  label: string;
  content: string;
};

function parseDetailedSchedule(value: string): DayScheduleDraft[] {
  const source = value.trim();
  if (!source) return [];

  const lines = source.split(/\r?\n/);
  const drafts: DayScheduleDraft[] = [];
  let currentLabel = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s*$/);
    if (match) {
      if (currentLabel) {
        drafts.push({
          label: currentLabel,
          content: currentContent.join("\n").trim(),
        });
      }
      currentLabel = match[1].trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }

  if (currentLabel) {
    drafts.push({
      label: currentLabel,
      content: currentContent.join("\n").trim(),
    });
  }

  if (drafts.length === 0) {
    return [{ label: "1일차", content: source }];
  }

  return drafts.map((item) => ({
    label: item.label.trim() || "일정",
    content: item.content,
  }));
}

function serializeDetailedSchedule(drafts: DayScheduleDraft[]) {
  const cleaned = drafts
    .map((item) => ({
      label: item.label.trim(),
      content: item.content.trim(),
    }))
    .filter((item) => item.label.length > 0 || item.content.length > 0);

  return cleaned
    .map((item) => {
      const safeLabel = item.label || "일정";
      return item.content ? `[${safeLabel}]\n${item.content}` : `[${safeLabel}]`;
    })
    .join("\n\n");
}

function createNextDayLabel(drafts: DayScheduleDraft[]) {
  const dayNumbers = drafts
    .map((item) => item.label.trim().match(/^(\d+)\s*일차$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => Number(match[1]))
    .filter((n) => Number.isFinite(n));
  const next = dayNumbers.length > 0 ? Math.max(...dayNumbers) + 1 : drafts.length + 1;
  return `${next}일차`;
}

export type PreviewWarning = {
  id: string;
  message: string;
  sectionId: "basic" | "price" | "schedule";
};

/** 미리보기 품질 경고: 원인 + 화면 영향. sectionId는 클릭 시 해당 아코디언 열기/스크롤용 */
function getPreviewWarnings(
  form: ProductFormState,
  hasPreviewImage: boolean,
): PreviewWarning[] {
  const warnings: PreviewWarning[] = [];

  if (!hasRealText(form.category)) {
    warnings.push({
      id: "category",
      message: "카테고리 미입력 → 카드/상세에 카테고리 칩이 비어 보입니다.",
      sectionId: "basic",
    });
  }

  if (!hasValidNumber(form.price) && !hasValidPriceOptionJson(form.options_json)) {
    warnings.push({
      id: "price",
      message: "가격 미입력 또는 0원 → 카드/상세에 '상담 후 견적'으로만 표시됩니다.",
      sectionId: "price",
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

/** 섹션별 완료/미완료 뱃지용 이슈 */
export type SectionId =
  | "basic"
  | "price"
  | "description"
  | "included"
  | "schedule"
  | "flight"
  | "terms";

export type IssueSeverity = "required" | "recommended";

/** 저장 실패 점프/포커스 재사용용 이슈 타입 */
export type FormIssue = {
  sectionId: SectionId;
  severity: IssueSeverity;
  message: string;
  anchorId?: string;
};

export type SectionIssue = FormIssue & {
  fieldKey: string;
};

export type SectionConfig = {
  id: SectionId;
  title: string;
  description?: string;
  getIssues: (form: ProductFormState) => SectionIssue[];
};

function hasValidPriceOption(form: ProductFormState): boolean {
  return hasValidPriceOptionJson(form.options_json);
}

const SECTIONS: SectionConfig[] = [
  {
    id: "basic",
    title: "기본 정보",
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
      if (!hasRealText(form.category)) {
        issues.push({
          sectionId: "basic",
          fieldKey: "category",
          message: "카테고리를 선택해 주세요.",
          anchorId: "form-field-basic-category",
          severity: "recommended",
        });
      }
      if (!hasRealText(form.theme)) {
        issues.push({
          sectionId: "basic",
          fieldKey: "theme",
          message: "테마를 선택하면 노출 품질이 좋아집니다.",
          anchorId: "form-field-basic-theme",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
  {
    id: "price",
    title: "가격·노출",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      const hasValidPrice = hasValidNumber(form.price);
      const hasOptions = hasValidPriceOption(form);
      if (!hasValidPrice && !hasOptions) {
        issues.push({
          sectionId: "price",
          fieldKey: "price",
          message: "가격(숫자)을 입력하거나, 가격 옵션 JSON을 등록해 주세요.",
          anchorId: "field-price-main",
          severity: "required",
        });
      }
      return issues;
    },
  },
  {
    id: "description",
    title: "설명·포인트",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      if (!hasRealText(form.description)) {
        issues.push({
          sectionId: "description",
          fieldKey: "description",
          message: "상품 설명을 입력해 주세요.",
          anchorId: "field-product-description",
          severity: "required",
        });
      }
      return issues;
    },
  },
  {
    id: "included",
    title: "포함·불포함·선택관광",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      const hasIncluded = hasRealText(form.included_items);
      const hasExcluded = hasRealText(form.excluded_items);
      const hasOptional = hasRealText(form.optional_tours);
      if (!hasIncluded && !hasExcluded && !hasOptional) {
        issues.push({
          sectionId: "included",
          fieldKey: "included",
          message: "포함·불포함·선택관광 중 최소 1개 이상 입력을 권장합니다.",
          anchorId: "field-included",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
  {
    id: "schedule",
    title: "상세 일정",
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
      } else {
        if (hasV2) {
          const emptyDays = v2Days.filter((d) => {
            const hasTitle = hasRealText(d.title) || hasRealText(d.dateText);
            const events = d.events ?? [];
            const hasEvent = events.some((e) => hasRealText(e.heading) || hasRealText(e.description));
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
      }
      return issues;
    },
  },
  {
    id: "flight",
    title: "항공편",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      const dep = hasRealText(form.departure_flight_name) ? form.departure_flight_name!.trim() : "";
      const arr = hasRealText(form.arrival_flight_name) ? form.arrival_flight_name!.trim() : "";
      if (dep && !/^[A-Z0-9]{2}\s*\d+/i.test(dep.replace(/\s/g, ""))) {
        issues.push({
          sectionId: "flight",
          fieldKey: "departure_flight_name",
          message: "출발 편명 형식(예: OZ 123)을 권장합니다.",
          anchorId: "form-field-flight-departure_flight_name",
          severity: "recommended",
        });
      }
      if (arr && !/^[A-Z0-9]{2}\s*\d+/i.test(arr.replace(/\s/g, ""))) {
        issues.push({
          sectionId: "flight",
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
    id: "terms",
    title: "약관·SEO",
    getIssues(form) {
      const issues: SectionIssue[] = [];
      if (!hasRealText(form.meta_title)) {
        issues.push({
          sectionId: "terms",
          fieldKey: "meta_title",
          message: "SEO 메타 제목을 입력하면 검색 노출에 유리합니다.",
          anchorId: "field-seo-title",
          severity: "recommended",
        });
      }
      if (!hasRealText(form.meta_description)) {
        issues.push({
          sectionId: "terms",
          fieldKey: "meta_description",
          message: "SEO 메타 설명을 입력하면 검색 노출에 유리합니다.",
          anchorId: "field-seo-desc",
          severity: "recommended",
        });
      }
      return issues;
    },
  },
];

/** 필수(required) 이슈만 섹션 순서대로 수집. handleSubmit 검증 및 스크롤/포커스용 */
function collectAllRequiredIssues(form: ProductFormState): SectionIssue[] {
  const out: SectionIssue[] = [];
  for (const section of SECTIONS) {
    const issues = section.getIssues(form).filter((i) => i.severity === "required");
    out.push(...issues);
  }
  return out;
}

/** 섹션별 이슈 전체 수집(required + recommended). 뱃지/저장 실패 점프 재사용 */
function collectFormIssues(form: ProductFormState): FormIssue[] {
  const out: FormIssue[] = [];
  for (const section of SECTIONS) {
    out.push(...section.getIssues(form));
  }
  return out;
}

function mapProductToForm(product: Product): ProductFormState {
  const includedItems = product.included_items?.trim() ?? "";
  const excludedItems = product.excluded_items?.trim() ?? "";
  const optionalTours = product.optional_tours?.trim() ?? "";
  const termsAndNotes = product.terms_and_notes?.trim() ?? "";
  const shouldRepairLegacyDetailMix =
    !includedItems && !excludedItems && (optionalTours.length > 0 || termsAndNotes.length > 0);

  return {
    title: product.title ?? "",
    description: product.description ?? "",
    product_source_url: product.product_source_url ?? "",
    point_benefits: product.point_benefits ?? "",
    point_tourism: normalizeOXValue(product.point_tourism),
    point_guide: normalizeOXValue(product.point_guide),
    meeting_info: normalizeOXValue(product.meeting_info),
    travel_insurance: normalizeOXValue(product.travel_insurance),
    included_items: shouldRepairLegacyDetailMix ? optionalTours : product.included_items ?? "",
    excluded_items: shouldRepairLegacyDetailMix ? termsAndNotes : product.excluded_items ?? "",
    departure_from_airport: product.departure_from_airport ?? "",
    departure_from_date: product.departure_from_date ?? "",
    departure_from_time: product.departure_from_time ?? "",
    departure_to_airport: product.departure_to_airport ?? "",
    departure_to_date: product.departure_to_date ?? "",
    departure_to_time: product.departure_to_time ?? "",
    departure_flight_name: product.departure_flight_name ?? "",
    departure_baggage_limit: product.departure_baggage_limit ?? "",
    arrival_from_airport: product.arrival_from_airport ?? "",
    arrival_from_date: product.arrival_from_date ?? "",
    arrival_from_time: product.arrival_from_time ?? "",
    arrival_to_airport: product.arrival_to_airport ?? "",
    arrival_to_date: product.arrival_to_date ?? "",
    arrival_to_time: product.arrival_to_time ?? "",
    arrival_flight_name: product.arrival_flight_name ?? "",
    arrival_baggage_limit: product.arrival_baggage_limit ?? "",
    detailed_schedule: product.detailed_schedule ?? "",
    optional_tours: shouldRepairLegacyDetailMix ? "" : product.optional_tours ?? "",
    min_departure_people: product.min_departure_people ?? "",
    terms_template_type:
      (product.terms_template_type as "" | TermsTemplateType | undefined) ?? "",
    terms_and_notes: shouldRepairLegacyDetailMix ? "" : product.terms_and_notes ?? "",
    meta_title: product.meta_title ?? "",
    meta_description: product.meta_description ?? "",
    image_url: product.image_url ?? "",
    images_json: normalizeImageList(product.images_json),
    category: product.category ?? "여행상품",
    theme: product.theme ?? "",
    price: typeof product.price === "number" ? product.price.toLocaleString("ko-KR") : "",
    duration: product.duration ?? "",
    itinerary: product.itinerary ?? "",
    inclusions: product.inclusions ?? "",
    is_active: product.is_active ?? true,
    is_featured_home: product.is_featured_home ?? false,
    sort_order: typeof product.sort_order === "number" ? String(product.sort_order) : "",
    status:
      product.status === "AVAILABLE" ||
      product.status === "LIMITED" ||
      product.status === "SOLD_OUT" ||
      product.status === "CONSULT_REQUIRED"
        ? product.status
        : "AVAILABLE",
    one_liner: product.one_liner ?? "",
    price_meta: product.price_meta ?? "",
    fuel_included:
      product.fuel_included === true ? "true" : product.fuel_included === false ? "false" : "",
    meta_info: product.meta_info ?? "",
    options_json: product.options ? JSON.stringify(product.options, null, 2) : "",
    itinerary_media_json: product.itinerary_media_json ?? {},
    itinerary_days_json:
      product.itinerary_days_json && product.itinerary_days_json.length > 0
        ? product.itinerary_days_json
        : timelineModelToStructuredDays(
            getTimelineModelFromSchedule(product.detailed_schedule ?? ""),
          ),
    itinerary_v2_json: product.itinerary_v2_json ?? { days: [] },
    legacy_itinerary_text: "",
    theme_chart_json: product.theme_chart_json?.items ?? [],
    overview_accommodation: product.overview_accommodation ?? "",
    overview_region: product.overview_region ?? "",
    overview_duration: product.overview_duration ?? "",
  };
}

export default function AdminProductManager() {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const isTaxonomyView = viewParam === "taxonomy";
  const isCreateView = viewParam === "create";
  const isListView = !viewParam || viewParam === "list";
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductFormState>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [sortField, setSortField] = useState<ProductSortKey>("sort_order");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [pendingFeaturedToggleId, setPendingFeaturedToggleId] = useState<string | null>(null);
  const [pendingMoveId, setPendingMoveId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [taxonomyItems, setTaxonomyItems] = useState<ProductTaxonomyWithUsage[]>([]);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState(true);
  const [taxonomyErrorMessage, setTaxonomyErrorMessage] = useState("");
  const [pendingTaxonomyDeleteId, setPendingTaxonomyDeleteId] = useState<string | null>(null);
  const [pendingTaxonomyCreateType, setPendingTaxonomyCreateType] = useState<"category" | "theme" | null>(
    null,
  );
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [newThemeInput, setNewThemeInput] = useState("");
  const [termsTemplates, setTermsTemplates] = useState<TermsTemplateMap>(createEmptyTermsTemplateMap());
  const [isTermsTemplatesLoading, setIsTermsTemplatesLoading] = useState(true);
  const [isTermsTemplatesSaving, setIsTermsTemplatesSaving] = useState(false);
  const [termsTemplatesErrorMessage, setTermsTemplatesErrorMessage] = useState("");
  const [isTermsTemplatesPanelOpen, setIsTermsTemplatesPanelOpen] = useState(false);
  const [activeSchedulePreviewIndex, setActiveSchedulePreviewIndex] = useState(0);
  const [showRawScheduleEditor, setShowRawScheduleEditor] = useState(false);
  /** 일정 입력 모드: 시각화(권장) vs 레거시 텍스트 */
  const [scheduleEditorMode, setScheduleEditorMode] = useState<"visual" | "legacy">("visual");
  /** 현재 선택된 이벤트 (상품 이미지 → 이 이벤트에 추가용). 일정 탭에서 이벤트 클릭 시 설정 */
  const [selectedEvent, setSelectedEvent] = useState<SelectedEventRef | null>(null);
  const [pasteToAddValue, setPasteToAddValue] = useState("");
  const [showImageImportGuideModal, setShowImageImportGuideModal] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftData, setDraftData] = useState<ProductFormDraft | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [productFormOpenSections, setProductFormOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    price: false,
    description: false,
    included: false,
    schedule: false,
    flight: false,
    terms: false,
  });
  /** 목차 네비에서 현재 스크롤 기준 활성 섹션 (IntersectionObserver로 갱신) */
  const [activeSectionId, setActiveSectionId] = useState<SectionId | null>("basic");
  /** lg 미만에서 입력|카드|상세 탭 전환 */
  const [smallScreenTab, setSmallScreenTab] = useState<"input" | "card" | "detail">("input");

  const departureFlightCode = useMemo(
    () => (form.departure_flight_name ? normalizeAirline(form.departure_flight_name) : null),
    [form.departure_flight_name],
  );
  const arrivalFlightCode = useMemo(
    () => (form.arrival_flight_name ? normalizeAirline(form.arrival_flight_name) : null),
    [form.arrival_flight_name],
  );

  const departureHasLogo = departureFlightCode ? Boolean(AIRLINE_LOGO_BY_CODE[departureFlightCode]) : false;
  const arrivalHasLogo = arrivalFlightCode ? Boolean(AIRLINE_LOGO_BY_CODE[arrivalFlightCode]) : false;
  /** 미리보기 디바이스 뷰 (클래스로만 구분) */
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  /** 미리보기용 로컬 이미지 파일 선택 시 ObjectURL 생성/해제용 */
  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
  const [previewImageObjectUrl, setPreviewImageObjectUrl] = useState<string | null>(null);
  /** 상세 미리보기에서 Sticky CTA 표시 여부 (UX 방해 시 숨김) */
  const [showDetailSticky, setShowDetailSticky] = useState(true);
  /** 상품명 추출 모달 */
  const [showTitleExtractModal, setShowTitleExtractModal] = useState(false);
  const [titleExtractPaste, setTitleExtractPaste] = useState("");
  const [titleCandidates, setTitleCandidates] = useState<string[]>([]);
  /** 대표 이미지 추천 모달 */
  const [showCoverRecommendModal, setShowCoverRecommendModal] = useState(false);
  const [coverCandidates, setCoverCandidates] = useState<CoverCandidate[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = 8;
  const { showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();

  function parseThemeList(value: string) {
    return value
      .split(/[,\n/|]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  function stringifyThemeList(list: string[]) {
    return list.join(",");
  }

  function showLocalToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2500);
  }

  /** 스크롤 오프셋: sticky 액션바 높이 + 여유 16px */
  function getStickyHeaderOffset(): number {
    if (typeof document === "undefined") return 80;
    const bar = document.getElementById("product-form-actionbar");
    const h = bar?.getBoundingClientRect().height ?? 0;
    return h + 16;
  }

  /** 네비/경고/이슈 클릭 시: 해당 섹션 열기 + DOM 반영 후 스크롤 + (anchorId 있으면 포커스). 토글이 아닌 항상 펼치기만 함. */
  function openSectionAndScrollTo(sectionId: SectionId, anchorId?: string) {
    setProductFormOpenSections((prev) => ({ ...prev, [sectionId]: true }));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const headerOffset = getStickyHeaderOffset();
        const targetId = anchorId ?? `form-section-${sectionId}`;
        const el = document.getElementById(targetId) as HTMLElement | null;
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top, behavior: "smooth" });
        if (anchorId && typeof el.focus === "function") {
          el.focus();
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  /** 검증 실패 시 섹션 열기 + 스크롤 + 포커스 + 토스트. 네비 클릭 시에도 호출되며, 항상 해당 섹션을 펼침만 함(토글 없음). */
  function openSectionAndFocus(opts: {
    sectionId: SectionId;
    anchorId?: string;
    reason?: string;
  }) {
    const { sectionId, anchorId, reason } = opts;
    openSectionAndScrollTo(sectionId, anchorId);
    if (reason) showLocalToast("error", reason);
  }

  /** 상품 공용 이미지 URL을 현재 선택된 이벤트의 images에 추가. 중복 시 스킵, cover/ sortOrder 자동 설정 */
  function addProductImageToSelectedEvent(url: string) {
    const ref = selectedEvent;
    if (!ref) return false;
    const normalized = normalizeUrlForCompare(url);
    if (!normalized || !/^https?:\/\//i.test(normalized)) return false;

    if (ref.editorType === "v2") {
      const days = form.itinerary_v2_json?.days ?? [];
      const day = days[ref.dayIndex];
      if (!day) return false;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return false;
      const images = event.images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      if (existingSet.has(normalized)) return false;
      const maxOrder = images.length === 0 ? -1 : Math.max(...images.map((i) => i.sortOrder ?? 0));
      const hasCover = images.some((i) => i.isCover);
      const newItem = {
        url: normalized,
        sortOrder: maxOrder + 1,
        isCover: !hasCover && images.length === 0,
      };
      setForm((prev: any) => ({
        ...prev,
        itinerary_v2_json: {
          ...prev.itinerary_v2_json,
          days: prev.itinerary_v2_json.days.map((d: ItineraryStructuredDay, di: number) =>
            di === ref.dayIndex
              ? {
                  ...d,
                  events: d.events.map((e: any, ei: number) =>
                    ei === ref.eventIndex ? { ...e, images: [...(e.images ?? []), newItem] } : e,
                  ),
                }
              : d,
          ),
        },
      }));
      return true;
    }

    if (ref.editorType === "structured") {
      const days = form.itinerary_days_json ?? [];
      const day = days[ref.dayIndex];
      if (!day) return false;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return false;
      const images = (event as { images?: Array<{ url: string; sortOrder?: number; isCover?: boolean }> }).images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      if (existingSet.has(normalized)) return false;
      const maxOrder = images.length === 0 ? -1 : Math.max(...images.map((i) => i.sortOrder ?? 0));
      const hasCover = images.some((i) => i.isCover);
      const newItem = {
        url: normalized,
        sortOrder: maxOrder + 1,
        isCover: !hasCover && images.length === 0,
      };
      setForm((prev: any) => ({
        ...prev,
        itinerary_days_json: prev.itinerary_days_json.map((d: ItineraryStructuredDay, di: number) =>
          di === ref.dayIndex
            ? {
                ...d,
                events: d.events.map((e: any, ei: number) =>
                  ei === ref.eventIndex ? { ...e, images: [...(e.images ?? []), newItem] } : e,
                ),
              }
            : d,
        ),
      }));
      return true;
    }

    return false;
  }

  /** 선택 이벤트 라벨 "Day N - 이벤트명" (상단 배너용) */
  function getSelectedEventLabel(): string | null {
    const ref = selectedEvent;
    if (!ref) return null;
    if (ref.editorType === "v2") {
      const days = form.itinerary_v2_json?.days ?? [];
      const day = days[ref.dayIndex];
      if (!day) return null;
      const event = day.events?.[ref.eventIndex];
      if (!event) return null;
      const dayNum = day.day ?? ref.dayIndex + 1;
      return `Day ${dayNum} - ${(event.heading || "").trim() || "이벤트"}`;
    }
    if (ref.editorType === "structured") {
      const days = form.itinerary_days_json ?? [];
      const day = days[ref.dayIndex];
      if (!day) return null;
      const event = day.events?.[ref.eventIndex];
      if (!event) return null;
      const dayNum = day.day ?? ref.dayIndex + 1;
      return `Day ${dayNum} - ${(event.heading || "").trim() || "이벤트"}`;
    }
    return null;
  }

  /** 붙여넣기 URL 목록을 선택 이벤트에 일괄 추가. 중복/cover/sortOrder 동일 규칙. 반환: 추가된 개수 */
  function addImagesToEvent(ref: SelectedEventRef | null, urls: string[]): number {
    if (!ref || urls.length === 0) return 0;
    const parsed = parsePastedImageUrls(urls.join("\n"));
    const valid = parsed.filter((u) => /^https?:\/\//i.test(normalizeUrlForCompare(u)));
    if (valid.length === 0) return 0;

    let added = 0;
    if (ref.editorType === "v2") {
      const days = form.itinerary_v2_json?.days ?? [];
      const day = days[ref.dayIndex];
      if (!day) return 0;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return 0;
      const images = event.images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      const hasCover = images.some((i) => i.isCover);
      let maxOrder = images.length === 0 ? -1 : Math.max(...images.map((i) => i.sortOrder ?? 0));
      const newItems: Array<{ url: string; sortOrder: number; isCover: boolean }> = [];
      for (const url of valid) {
        const normalized = normalizeUrlForCompare(url);
        if (!normalized || existingSet.has(normalized)) continue;
        existingSet.add(normalized);
        maxOrder += 1;
        newItems.push({
          url: normalized,
          sortOrder: maxOrder,
          isCover: !hasCover && newItems.length === 0,
        });
        added += 1;
      }
      if (newItems.length === 0) return added;
      setForm((prev: any) => ({
        ...prev,
        itinerary_v2_json: {
          ...prev.itinerary_v2_json,
          days: prev.itinerary_v2_json.days.map((d: ItineraryStructuredDay, di: number) =>
            di === ref.dayIndex
              ? {
                  ...d,
                  events: d.events.map((e: any, ei: number) =>
                    ei === ref.eventIndex
                      ? { ...e, images: [...(e.images ?? []), ...newItems] }
                      : e,
                  ),
                }
              : d,
          ),
        },
      }));
      return added;
    }

    if (ref.editorType === "structured") {
      const days = form.itinerary_days_json ?? [];
      const day = days[ref.dayIndex];
      if (!day) return 0;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return 0;
      const images = (event as { images?: Array<{ url: string; sortOrder?: number; isCover?: boolean }> }).images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      const hasCover = images.some((i) => i.isCover);
      let maxOrder = images.length === 0 ? -1 : Math.max(...images.map((i) => i.sortOrder ?? 0));
      const newItems: Array<{ url: string; sortOrder: number; isCover: boolean }> = [];
      for (const url of valid) {
        const normalized = normalizeUrlForCompare(url);
        if (!normalized || existingSet.has(normalized)) continue;
        existingSet.add(normalized);
        maxOrder += 1;
        newItems.push({
          url: normalized,
          sortOrder: maxOrder,
          isCover: !hasCover && newItems.length === 0,
        });
        added += 1;
      }
      if (newItems.length === 0) return added;
      setForm((prev: any) => ({
        ...prev,
        itinerary_days_json: prev.itinerary_days_json.map((d: ItineraryStructuredDay, di: number) =>
          di === ref.dayIndex
            ? {
                ...d,
                events: d.events.map((e: any, ei: number) =>
                  ei === ref.eventIndex
                    ? { ...e, images: [...(e.images ?? []), ...newItems] }
                    : e,
                ),
              }
            : d,
        ),
      }));
      return added;
    }
    return 0;
  }

  async function loadProducts(args?: {
    page?: number;
    sortField?: ProductSortKey;
    sortDirection?: "asc" | "desc";
    keywordOverride?: string;
    featuredOnlyOverride?: boolean;
  }) {
    const effectivePage = args?.page ?? page;
    const effectiveSortField = args?.sortField ?? sortField;
    const effectiveSortDirection = args?.sortDirection ?? sortDirection;
    const effectiveKeyword = args?.keywordOverride ?? debouncedKeyword;
    const effectiveFeaturedOnly =
      typeof args?.featuredOnlyOverride === "boolean"
        ? args.featuredOnlyOverride
        : showFeaturedOnly;

    try {
      setErrorMessage("");
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(effectivePage));
      params.set("pageSize", String(pageSize));
      params.set("sortField", effectiveSortField);
      params.set("sortDirection", effectiveSortDirection);
      if (effectiveKeyword.trim() !== "") {
        params.set("q", effectiveKeyword.trim());
      }
      if (effectiveFeaturedOnly) {
        params.set("featuredOnly", "true");
      }

      const response = await fetch(`/api/admin/products?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as
        | { items: Product[]; total: number }
        | { message?: string };
      if (!response.ok || !("items" in result)) {
        const msg = "message" in result ? result.message : "상품 목록 조회에 실패했습니다.";
        setErrorMessage(msg ?? "상품 목록 조회에 실패했습니다.");
        return;
      }
      setProducts(
        result.items.map((item) => {
          const images = normalizeImageList(item.images_json);
          return {
            ...item,
            images_json: images,
            image_url: images[0] ?? item.image_url ?? "",
          };
        }),
      );
      setTotalCount(result.total);
    } catch {
      setErrorMessage("상품 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTaxonomies() {
    try {
      setTaxonomyErrorMessage("");
      setIsTaxonomyLoading(true);
      const response = await fetch("/api/admin/product-taxonomies", { cache: "no-store" });
      const result = (await response.json()) as ProductTaxonomyWithUsage[] | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "분류 목록 조회에 실패했습니다.";
        setTaxonomyErrorMessage(msg ?? "분류 목록 조회에 실패했습니다.");
        return;
      }
      setTaxonomyItems(result as ProductTaxonomyWithUsage[]);
        if (Array.isArray(result) && (result as ProductTaxonomyWithUsage[]).length > 0) {
          setErrorMessage("");
        }
    } catch {
      setTaxonomyErrorMessage("분류 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsTaxonomyLoading(false);
    }
  }

  async function loadTermsTemplates() {
    try {
      setIsTermsTemplatesLoading(true);
      setTermsTemplatesErrorMessage("");
      const response = await fetch("/api/admin/terms-templates", { cache: "no-store" });
      const result = (await response.json()) as Partial<TermsTemplateMap> | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "약관 템플릿 조회에 실패했습니다.";
        setTermsTemplatesErrorMessage(msg ?? "약관 템플릿 조회에 실패했습니다.");
        return;
      }
      const templateResult = result as Partial<TermsTemplateMap>;
      setTermsTemplates({
        overseas_brokerage: templateResult.overseas_brokerage ?? "",
        domestic_brokerage: templateResult.domestic_brokerage ?? "",
        overseas_direct: templateResult.overseas_direct ?? "",
        domestic_direct: templateResult.domestic_direct ?? "",
      });
    } catch {
      setTermsTemplatesErrorMessage("약관 템플릿 조회 중 오류가 발생했습니다.");
    } finally {
      setIsTermsTemplatesLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([loadProducts({ page: 1 }), loadTaxonomies(), loadTermsTemplates()]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      if (keyword.trim() !== "") {
        setPage(1);
        loadProducts({ page: 1, keywordOverride: keyword });
      } else {
        loadProducts({ page: 1, keywordOverride: "" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  /** 폼 제출 (액션 바 [저장] 및 form onSubmit에서 공통 호출) */
  const submit = () => void handleSubmit(undefined);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const requiredIssues = SECTIONS.flatMap((s) =>
      (sectionIssuesBySection[s.id] ?? []).filter((i) => i.severity === "required"),
    );
    if (requiredIssues.length > 0) {
      const first = requiredIssues[0];
      const sectionTitle = SECTIONS.find((s) => s.id === first.sectionId)?.title ?? first.sectionId;
      openSectionAndFocus({
        sectionId: first.sectionId,
        anchorId: first.anchorId,
        reason: `저장 실패: ${sectionTitle} - ${first.message}`,
      });
      setIsSubmitting(false);
      return;
    }

    const title = form.title.trim();
    const description = form.description.trim();

    try {
      const normalizedIncludedItems = form.included_items.trim();
      const normalizedExcludedItems = form.excluded_items.trim();
      const normalizedOptionalTours = form.optional_tours.trim();
      const normalizedTermsAndNotes = form.terms_and_notes.trim();
      const shouldRepairLegacyDetailMix =
        Boolean(editingId) &&
        !normalizedIncludedItems &&
        !normalizedExcludedItems &&
        (normalizedOptionalTours.length > 0 || normalizedTermsAndNotes.length > 0);
      const resolvedIncludedItems = shouldRepairLegacyDetailMix
        ? normalizedOptionalTours
        : normalizedIncludedItems;
      const resolvedExcludedItems = shouldRepairLegacyDetailMix
        ? normalizedTermsAndNotes
        : normalizedExcludedItems;
      const resolvedOptionalTours = shouldRepairLegacyDetailMix ? "" : normalizedOptionalTours;
      const resolvedTermsAndNotes = shouldRepairLegacyDetailMix ? "" : normalizedTermsAndNotes;
      const normalizedPrice = form.price.replace(/,/g, "").replace(/~/g, "").trim();
      const normalizedImages = normalizeImageList(form.images_json);
      const primaryImageUrl = form.image_url.trim() || normalizedImages[0] || "";
      const payload = {
        title: title,
        description: form.description,
        meta_title: form.meta_title.trim() === "" ? undefined : form.meta_title,
        meta_description: form.meta_description.trim() === "" ? undefined : form.meta_description,
        point_benefits: form.point_benefits.trim() === "" ? undefined : form.point_benefits,
        point_tourism: form.point_tourism,
        point_guide: form.point_guide,
        meeting_info: form.meeting_info,
        travel_insurance: form.travel_insurance,
        included_items: resolvedIncludedItems === "" ? undefined : resolvedIncludedItems,
        excluded_items: resolvedExcludedItems === "" ? undefined : resolvedExcludedItems,
        departure_from_airport:
          form.departure_from_airport.trim() === "" ? undefined : form.departure_from_airport,
        departure_from_date: form.departure_from_date.trim() === "" ? undefined : form.departure_from_date,
        departure_from_time: form.departure_from_time.trim() === "" ? undefined : form.departure_from_time,
        departure_to_airport: form.departure_to_airport.trim() === "" ? undefined : form.departure_to_airport,
        departure_to_date: form.departure_to_date.trim() === "" ? undefined : form.departure_to_date,
        departure_to_time: form.departure_to_time.trim() === "" ? undefined : form.departure_to_time,
        departure_flight_name:
          form.departure_flight_name.trim() === "" ? undefined : form.departure_flight_name,
        departure_baggage_limit:
          form.departure_baggage_limit.trim() === "" ? undefined : form.departure_baggage_limit,
        arrival_from_airport:
          form.arrival_from_airport.trim() === "" ? undefined : form.arrival_from_airport,
        arrival_from_date: form.arrival_from_date.trim() === "" ? undefined : form.arrival_from_date,
        arrival_from_time: form.arrival_from_time.trim() === "" ? undefined : form.arrival_from_time,
        arrival_to_airport: form.arrival_to_airport.trim() === "" ? undefined : form.arrival_to_airport,
        arrival_to_date: form.arrival_to_date.trim() === "" ? undefined : form.arrival_to_date,
        arrival_to_time: form.arrival_to_time.trim() === "" ? undefined : form.arrival_to_time,
        arrival_flight_name: form.arrival_flight_name.trim() === "" ? undefined : form.arrival_flight_name,
        arrival_baggage_limit:
          form.arrival_baggage_limit.trim() === "" ? undefined : form.arrival_baggage_limit,
        detailed_schedule:
          form.itinerary_days_json.length > 0
            ? serializeStructuredDaysToSchedule(form.itinerary_days_json)
            : (form.detailed_schedule.trim() === "" ? undefined : form.detailed_schedule),
        optional_tours: resolvedOptionalTours === "" ? undefined : resolvedOptionalTours,
        min_departure_people: form.min_departure_people.trim() === "" ? undefined : form.min_departure_people,
        terms_template_type: form.terms_template_type === "" ? undefined : form.terms_template_type,
        terms_and_notes: resolvedTermsAndNotes === "" ? undefined : resolvedTermsAndNotes,
        product_source_url: form.product_source_url.trim() === "" ? undefined : form.product_source_url,
        image_url: primaryImageUrl,
        images_json: normalizedImages.length > 0 ? normalizedImages : undefined,
        category: form.category,
        theme: form.theme.trim() === "" ? null : form.theme,
        price: normalizedPrice === "" ? null : Number(normalizedPrice),
        duration: form.duration.trim() === "" ? null : form.duration,
        itinerary: form.itinerary.trim() === "" ? null : form.itinerary,
        inclusions: form.inclusions.trim() === "" ? null : form.inclusions,
        is_active: form.is_featured_home ? true : form.is_active,
        is_featured_home: form.is_featured_home,
        sort_order: form.sort_order.trim() === "" ? null : Number(form.sort_order),
        status:
          form.status && ["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"].includes(form.status)
            ? form.status
            : undefined,
        one_liner: form.one_liner.trim() === "" ? undefined : form.one_liner.trim(),
        price_meta: form.price_meta.trim() === "" ? undefined : form.price_meta.trim(),
        meta_info: form.meta_info.trim() === "" ? undefined : form.meta_info.trim(),
        fuel_included:
          form.fuel_included === ""
            ? undefined
            : form.fuel_included === "true"
              ? true
              : form.fuel_included === "false"
                ? false
                : undefined,
        options: (() => {
          const raw = form.options_json.trim();
          if (!raw) return undefined;
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            if (parsed && typeof parsed === "object" && Array.isArray(parsed.groups) && parsed.groups.length > 0) {
              return parsed;
            }
            return undefined;
          } catch {
            return undefined;
          }
        })(),
        itinerary_media_json:
          (() => {
            const media = form.itinerary_media_json;
            const dayCount =
              form.itinerary_days_json.length > 0
                ? form.itinerary_days_json.length
                : parseDetailedSchedule(form.detailed_schedule).length;
            const cleaned = Object.fromEntries(
              Object.entries(media).filter(([key, v]) => {
                if (typeof v !== "string" || !v.trim()) return false;
                const n = parseInt(key, 10);
                return !Number.isNaN(n) && n >= 1 && n <= dayCount;
              }),
            );
            return Object.keys(cleaned).length > 0 ? cleaned : undefined;
          })(),
        itinerary_days_json:
          form.itinerary_days_json.length > 0 ? form.itinerary_days_json : null,
        itinerary_v2_json:
          form.itinerary_v2_json.days.length > 0 ? form.itinerary_v2_json : null,
        theme_chart_json: (() => {
          const items = form.theme_chart_json.filter(
            (i) => i.label?.trim() && typeof i.percent === "number",
          );
          return items.length >= 2 ? { items } : null;
        })(),
        overview_accommodation: form.overview_accommodation.trim() === "" ? undefined : form.overview_accommodation.trim(),
        overview_region: form.overview_region.trim() === "" ? undefined : form.overview_region.trim(),
        overview_duration: form.overview_duration.trim() === "" ? undefined : form.overview_duration.trim(),
      };

      const endpoint = editingId ? `/api/admin/products/${editingId}` : "/api/admin/products";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string; warningCode?: string };

      if (!response.ok) {
        setErrorMessage(result.message ?? "상품 저장에 실패했습니다.");
        showLocalToast("error", result.message ?? "상품 저장에 실패했습니다.");
        return;
      }

      if (result.warningCode === "IMAGES_JSON_NOT_PERSISTED") {
        showLocalToast(
          "error",
          "DB에 images_json 컬럼이 없어 대표 이미지 외 나머지는 저장되지 않았습니다. supabase/products_images_json_upgrade.sql 실행이 필요합니다.",
        );
      } else {
        showToast("success", editingId ? "상품이 수정되었습니다." : "상품이 등록되었습니다.");
      }
      setEditingId(null);
      setForm(initialFormState);
      setActiveSchedulePreviewIndex(0);
      setShowRawScheduleEditor(false);
      setScheduleEditorMode("visual");
      localStorage.removeItem(getDraftKey(editingId));
      setShowDraftBanner(false);
      setDraftData(null);
      await loadProducts();
    } catch (error) {
      const message = error instanceof Error ? error.message : "상품 저장 중 오류가 발생했습니다.";
      setErrorMessage(message);
      showLocalToast("error", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "상품 삭제",
      description: "이 상품을 삭제하면 되돌릴 수 없습니다. 계속 진행할까요?",
      confirmLabel: "삭제",
      cancelLabel: "취소",
    });
    if (!ok) return;

    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        showToast("error", result.message ?? "상품 삭제에 실패했습니다.");
        return;
      }

      if (editingId === id) {
        setEditingId(null);
        setForm(initialFormState);
        setActiveSchedulePreviewIndex(0);
        setShowRawScheduleEditor(false);
        setScheduleEditorMode("visual");
      }
      showToast("success", "상품이 삭제되었습니다.");
      await loadProducts();
    } catch {
      showToast("error", "상품 삭제 중 오류가 발생했습니다.");
    }
  }

  const featuredCount = useMemo(
    () => products.filter((product) => Boolean(product.is_featured_home)).length,
    [products],
  );
  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingId),
    [products, editingId],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedProducts = products;
  const categoryOptions = useMemo(() => {
    return taxonomyItems
      .filter((item) => item.type === "category" && item.is_active)
      .map((item) => item.name);
  }, [taxonomyItems]);
  const selectedThemes = useMemo(() => parseThemeList(form.theme), [form.theme]);
  const availableThemeOptions = useMemo(
    () =>
      taxonomyItems
        .filter((item) => item.type === "theme" && item.is_active)
        .map((item) => item.name),
    [taxonomyItems],
  );
  const categoryTaxonomies = useMemo(
    () => taxonomyItems.filter((item) => item.type === "category"),
    [taxonomyItems],
  );
  const themeTaxonomies = useMemo(
    () => taxonomyItems.filter((item) => item.type === "theme"),
    [taxonomyItems],
  );
  const scheduleDrafts = useMemo(
    () => parseDetailedSchedule(form.detailed_schedule),
    [form.detailed_schedule],
  );
  const effectiveDayCount =
    form.itinerary_days_json.length > 0
      ? form.itinerary_days_json.length
      : scheduleDrafts.length;
  const selectedTermsTemplateContent = useMemo(() => {
    if (!form.terms_template_type) return "";
    return termsTemplates[form.terms_template_type] ?? "";
  }, [form.terms_template_type, termsTemplates]);

  /** 폼 + 이미지(URL 또는 File ObjectURL) 기반 미리보기용 Product (공용 로직) */
  const previewProduct = useMemo(
    () =>
      formToPreviewProduct(
        form,
        previewImageObjectUrl ?? form.images_json[0] ?? form.image_url?.trim() ?? "",
      ),
    [form, previewImageObjectUrl],
  );

  /** 로컬 fallback: 카드/상세 props (API 실패 시 사용) */
  const localCardProps = useMemo<ProductCardV2Props>(() => {
    const payload = productToCardV2PropsPayload(previewProduct);
    return {
      ...payload,
      onClickDetail: () => {},
      onClickConsult: () => {},
    };
  }, [previewProduct]);

  const localDetailProps = useMemo(() => {
    const payload = productToDetailV2PropsPayload(previewProduct);
    return {
      ...payload,
      onConsultClick: () => {},
      kakaoHref: "#",
      trust: undefined,
    };
  }, [previewProduct]);

  /** 서버 preview API 응답 (우선 사용, 실패 시 로컬 fallback) */
  const [serverPreview, setServerPreview] = useState<{
    previewProduct: Product;
    cardProps: ReturnType<typeof productToCardV2PropsPayload>;
    detailProps: ReturnType<typeof productToDetailV2PropsPayload>;
  } | null>(null);

  const effectivePreviewProduct = serverPreview?.previewProduct ?? previewProduct;
  const previewCardProps: ProductCardV2Props = serverPreview
    ? { ...serverPreview.cardProps, onClickDetail: () => {}, onClickConsult: () => {} }
    : localCardProps;
  const previewDetailProps = serverPreview
    ? {
        ...serverPreview.detailProps,
        onConsultClick: () => {},
        kakaoHref: "#",
        trust: undefined,
      }
    : localDetailProps;

  const hasPreviewImage = !!(form.image_url?.trim() || form.images_json.length > 0 || previewImageFile);
  const previewWarnings = useMemo(
    () => getPreviewWarnings(form, hasPreviewImage),
    [form, hasPreviewImage],
  );

  const sectionIssuesBySection = useMemo(() => {
    const out: Record<SectionId, SectionIssue[]> = {} as Record<SectionId, SectionIssue[]>;
    for (const section of SECTIONS) {
      out[section.id] = section.getIssues(form);
    }
    const featuredCountNow = products.filter((p) => Boolean(p.is_featured_home)).length;
    const editingProd = products.find((p) => p.id === editingId);
    if (
      form.is_featured_home &&
      !editingProd?.is_featured_home &&
      featuredCountNow >= FEATURED_PRODUCT_LIMIT
    ) {
      out.price = [
        ...(out.price ?? []),
        {
          sectionId: "price",
          fieldKey: "featured",
          message: `메인 추천상품은 최대 ${FEATURED_PRODUCT_LIMIT}개까지 설정할 수 있습니다.`,
          anchorId: "field-main-reco",
          severity: "required" as const,
        },
      ];
    }
    return out;
  }, [form, products, editingId]);

  const completedSectionCount = useMemo(() => {
    return SECTIONS.filter(
      (s) => (sectionIssuesBySection[s.id] ?? []).filter((i) => i.severity === "required").length === 0,
    ).length;
  }, [sectionIssuesBySection]);

  const sectionNavIssueCounts = useMemo(() => {
    const out: Record<string, { required: number; recommended: number }> = {};
    for (const s of SECTIONS) {
      const issues = sectionIssuesBySection[s.id] ?? [];
      out[s.id] = {
        required: issues.filter((i) => i.severity === "required").length,
        recommended: issues.filter((i) => i.severity === "recommended").length,
      };
    }
    return out;
  }, [sectionIssuesBySection]);

  /** 액션 바 진행률/필수 누락용 이슈 목록 (섹션 순서) */
  const formIssuesForBar = useMemo(
    () => SECTIONS.flatMap((s) => sectionIssuesBySection[s.id] ?? []),
    [sectionIssuesBySection],
  );

  /** 일정에서 이미지 URL 수집 (대표 이미지 추천: 상품 이미지 없을 때) — Day1 cover 또는 Day1 첫 이벤트 첫 이미지 우선 */
  const itineraryImageUrls = useMemo(() => {
    const out: string[] = [];
    const v2Days = form.itinerary_v2_json?.days ?? [];
    if (v2Days.length > 0) {
      const day1 = v2Days[0];
      if (day1?.coverImageUrl?.trim()) out.push(day1.coverImageUrl.trim());
      const events = day1?.events ?? [];
      for (const ev of events) {
        const imgs = ev.images ?? [];
        for (const img of imgs) {
          if (typeof img.url === "string" && img.url.trim()) {
            out.push(img.url.trim());
            break;
          }
        }
      }
    }
    const structDays = form.itinerary_days_json ?? [];
    if (out.length === 0 && structDays.length > 0) {
      const day1 = structDays[0];
      const events = (day1 as { events?: Array<{ images?: Array<{ url?: string }> }> })?.events ?? [];
      for (const ev of events) {
        const imgs = ev.images ?? [];
        for (const img of imgs) {
          if (typeof img.url === "string" && img.url.trim()) {
            out.push(img.url.trim());
            break;
          }
        }
      }
    }
    return out;
  }, [form.itinerary_v2_json, form.itinerary_days_json]);

  useEffect(() => {
    if (!(isCreateView || editingId)) return;
    const key = getDraftKey(editingId);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        parsed &&
        parsed.version === 1 &&
        parsed.form &&
        typeof parsed.savedAt === "number"
      ) {
        setDraftData(parsed as unknown as ProductFormDraft);
        setShowDraftBanner(true);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }, [isCreateView, editingId]);

  /** 상단 액션바 높이에 맞춰 좌측 네비 sticky top 오프셋 설정 (겹침 방지) */
  useEffect(() => {
    if (!(isCreateView || editingId)) return;
    const setNavTop = () => {
      const bar = document.getElementById("product-form-actionbar");
      const h = bar?.getBoundingClientRect().height ?? 0;
      const offset = h + 16;
      document.documentElement.style.setProperty("--product-form-nav-top", `${offset}px`);
    };
    const t = setTimeout(setNavTop, 100);
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(setNavTop);
    });
    const observe = () => {
      const bar = document.getElementById("product-form-actionbar");
      if (bar) ro.observe(bar);
    };
    const t2 = setTimeout(observe, 150);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      ro.disconnect();
    };
  }, [isCreateView, editingId]);

  /** IntersectionObserver: 스크롤 시 상단 근처에 들어온 섹션을 activeSectionId로 설정.
   * rootMargin "-20% 0px -70% 0px": 뷰포트 상단 20%·하단 70%를 제외한 중간 10% 대만 "활성 구간"으로 봄 → 섹션 헤더가 그 구간에 들어오면 active.
   * threshold 0.01: 1%만 보여도 교차로 간주해 반응 속도 확보. */
  useEffect(() => {
    if (!(isCreateView || editingId)) return;
    const visibleIds = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id?.startsWith("form-section-")
            ? entry.target.id.slice("form-section-".length)
            : "";
          if (!id) continue;
          if (entry.isIntersecting) visibleIds.add(id);
          else visibleIds.delete(id);
        }
        const first = SECTIONS.find((s) => visibleIds.has(s.id));
        setActiveSectionId(first?.id ?? null);
      },
      {
        root: null,
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0.01,
      },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(`form-section-${s.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [isCreateView, editingId]);

  function handleSaveDraft() {
    setIsSavingDraft(true);
    try {
      const key = getDraftKey(editingId);
      const payload: ProductFormDraft = { version: 1, form, savedAt: Date.now() };
      localStorage.setItem(key, JSON.stringify(payload));
      showLocalToast("success", "임시저장 완료");
    } catch {
      showLocalToast("error", "임시저장에 실패했습니다.");
    } finally {
      setIsSavingDraft(false);
    }
  }

  function handleRestoreDraft() {
    if (!draftData) return;
    setForm(draftData.form);
    localStorage.removeItem(getDraftKey(editingId));
    setDraftData(null);
    setShowDraftBanner(false);
    showLocalToast("success", "임시 저장본을 복원했습니다.");
  }

  function handleDismissDraft() {
    localStorage.removeItem(getDraftKey(editingId));
    setDraftData(null);
    setShowDraftBanner(false);
  }

  function handlePreviewClick() {
    if (typeof window === "undefined") return;
    const el = document.getElementById("product-form-preview-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setSmallScreenTab("card");
    }
  }

  function handleWarningClick(sectionId: SectionId) {
    openSectionAndFocus({ sectionId });
  }

  function runTitleExtract() {
    const candidates = extractTitleCandidates(titleExtractPaste);
    setTitleCandidates(candidates);
    showLocalToast("success", `후보 ${candidates.length}개 추출`);
  }

  async function applyTitleCandidate(candidate: string, append: boolean) {
    const current = form.title.trim();
    if (current && !append) {
      const ok = await confirm({
        title: "상품명 덮어쓰기",
        description: "이미 입력된 상품명이 있습니다. 덮어쓸까요?",
        confirmLabel: "덮어쓰기",
        cancelLabel: "취소",
      });
      if (!ok) return;
    }
    if (append && current) {
      setForm((prev) => ({ ...prev, title: `${current} ${candidate}`.trim() }));
      showLocalToast("success", "상품명에 이어서 붙였습니다.");
    } else {
      setForm((prev) => ({ ...prev, title: candidate }));
      showLocalToast("success", "상품명 적용 완료");
    }
    setShowTitleExtractModal(false);
    setTitleExtractPaste("");
    setTitleCandidates([]);
  }

  function openCoverRecommendModal() {
    const productImages = normalizeImageList(form.images_json);
    const currentCover = form.image_url?.trim();
    const list = currentCover && !productImages.includes(currentCover) ? [currentCover, ...productImages] : productImages;
    const candidates = recommendCoverCandidates({
      productImages: list,
      itineraryImages: list.length === 0 ? itineraryImageUrls : undefined,
    });
    setCoverCandidates(candidates);
    setShowCoverRecommendModal(true);
  }

  function setCoverAsPrimary(url: string) {
    const hadCover = !!(form.image_url?.trim());
    setForm((prev) => ({ ...prev, image_url: url }));
    showLocalToast("success", hadCover ? "대표 이미지를 변경했습니다." : "대표 이미지가 지정되었습니다.");
    setShowCoverRecommendModal(false);
  }

  /** File 선택 시 ObjectURL 생성, 언마운트/파일 변경 시 revoke */
  useEffect(() => {
    if (!previewImageFile) {
      setPreviewImageObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewImageFile);
    setPreviewImageObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewImageFile]);

  /** 400ms debounce로 preview API 호출, 성공 시 serverPreview 설정, 실패 시 로컬 fallback 유지 */
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRequestIdRef = useRef(0);
  useEffect(() => {
    setServerPreview(null);
    previewDebounceRef.current && clearTimeout(previewDebounceRef.current);
    const requestId = ++previewRequestIdRef.current;
    previewDebounceRef.current = setTimeout(() => {
      previewDebounceRef.current = null;
      const imageUrl = previewImageObjectUrl ?? form.images_json[0] ?? form.image_url?.trim() ?? "";
      fetch("/api/admin/products/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, imageUrl }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        })
        .then((data: { previewProduct: Product; cardProps: unknown; detailProps: unknown }) => {
          if (requestId !== previewRequestIdRef.current) return;
          setServerPreview({
            previewProduct: data.previewProduct,
            cardProps: data.cardProps as ReturnType<typeof productToCardV2PropsPayload>,
            detailProps: data.detailProps as ReturnType<typeof productToDetailV2PropsPayload>,
          });
        })
        .catch(() => {
          if (requestId !== previewRequestIdRef.current) return;
          setServerPreview(null);
        });
    }, 400);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [form, previewImageObjectUrl]);

  /** previewProduct 변경 시 콘솔 출력 (구성 확인용) */
  useEffect(() => {
    if (typeof window === "undefined") return;
    console.log("[AdminProductManager] previewProduct", effectivePreviewProduct);
  }, [effectivePreviewProduct]);

  useEffect(() => {
    if (categoryOptions.length === 0) {
      if (form.category === "") return;
      setForm((prev) => ({ ...prev, category: "" }));
      return;
    }
    if (categoryOptions.includes(form.category)) return;
    setForm((prev) => ({ ...prev, category: categoryOptions[0] }));
  }, [categoryOptions, form.category]);

  useEffect(() => {
    const allowedThemes = new Set(availableThemeOptions);
    const cleaned = parseThemeList(form.theme).filter((theme) => allowedThemes.has(theme));
    const cleanedText = stringifyThemeList(cleaned);
    if (cleanedText === form.theme) return;
    setForm((prev) => ({ ...prev, theme: cleanedText }));
  }, [availableThemeOptions, form.theme]);

  useEffect(() => {
    if (scheduleDrafts.length === 0) {
      if (activeSchedulePreviewIndex === 0) return;
      setActiveSchedulePreviewIndex(0);
      return;
    }
    if (activeSchedulePreviewIndex < scheduleDrafts.length) return;
    setActiveSchedulePreviewIndex(scheduleDrafts.length - 1);
  }, [scheduleDrafts, activeSchedulePreviewIndex]);

  function updateScheduleDrafts(updater: (current: DayScheduleDraft[]) => DayScheduleDraft[]) {
    setForm((prev) => {
      const current = parseDetailedSchedule(prev.detailed_schedule);
      const next = updater(current);
      return {
        ...prev,
        detailed_schedule: serializeDetailedSchedule(next),
      };
    });
  }

  function addScheduleDay() {
    const nextIndex = scheduleDrafts.length;
    updateScheduleDrafts((current) => [
      ...current,
      {
        label: createNextDayLabel(current),
        content: "",
      },
    ]);
    setActiveSchedulePreviewIndex(nextIndex);
  }

  function appendScheduleTemplate(index: number, templateText: string) {
    updateScheduleDrafts((current) =>
      current.map((draft, draftIndex) => {
        if (draftIndex !== index) return draft;
        const nextContent = draft.content.trim()
          ? `${draft.content.trim()}\n${templateText}`
          : templateText;
        return { ...draft, content: nextContent };
      }),
    );
    setActiveSchedulePreviewIndex(index);
  }

  async function saveTermsTemplates() {
    try {
      setIsTermsTemplatesSaving(true);
      setTermsTemplatesErrorMessage("");
      const response = await fetch("/api/admin/terms-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(termsTemplates),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setTermsTemplatesErrorMessage(result.message ?? "약관 템플릿 저장에 실패했습니다.");
        return;
      }
      showToast("success", "약관 템플릿을 저장했습니다.");
    } catch {
      setTermsTemplatesErrorMessage("약관 템플릿 저장 중 오류가 발생했습니다.");
    } finally {
      setIsTermsTemplatesSaving(false);
    }
  }

  function movePage(nextPage: number) {
    const clamped = Math.max(1, Math.min(nextPage, totalPages));
    setPage(clamped);
    loadProducts({ page: clamped });
  }

  function toggleSelectAllForPage() {
    if (products.length === 0) return;
    const pageIds = products.map((product) => product.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  }

  async function handleBulkDeleteSelected() {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: "선택 상품 삭제",
      description: `선택된 ${selectedIds.length}개 상품을 삭제합니다. 계속 진행할까요?`,
      confirmLabel: "삭제",
      cancelLabel: "취소",
    });
    if (!ok) return;

    setErrorMessage("");
    try {
      const ids = [...selectedIds];
      setSelectedIds([]);
      await Promise.allSettled(
        ids.map(async (id) => {
          const response = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
          if (!response.ok) {
            // 개별 오류는 토스트로만 알림
            const result = (await response.json()) as { message?: string };
        showToast("error", result.message ?? "일부 상품 삭제에 실패했습니다.");
          }
        }),
      );
      await loadProducts({ page: 1 });
      setPage(1);
      showToast("success", "선택한 상품을 삭제했습니다.");
    } catch {
      showToast("error", "선택 상품 삭제 중 오류가 발생했습니다.");
    }
  }

  function handleSortChange(field: ProductSortKey) {
    let nextDirection: "asc" | "desc" = "asc";
    if (sortField === field) {
      nextDirection = sortDirection === "asc" ? "desc" : "asc";
    }
    setSortField(field);
    setSortDirection(nextDirection);
    setPage(1);
    loadProducts({ page: 1, sortField: field, sortDirection: nextDirection });
  }

  function addCustomCategory() {
    const value = newCategoryInput.trim();
    if (!value) return;
    setPendingTaxonomyCreateType("category");
    fetch("/api/admin/product-taxonomies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", name: value }),
    })
      .then(async (response) => {
        const result = (await response.json()) as { message?: string };
        if (!response.ok) {
          showToast("error", result.message ?? "카테고리 추가에 실패했습니다.");
          return;
        }
        setForm((prev) => ({ ...prev, category: value }));
        setNewCategoryInput("");
        showToast("success", "카테고리를 추가했습니다.");
        await loadTaxonomies();
      })
      .catch(() => {
        showToast("error", "카테고리 추가 중 오류가 발생했습니다.");
      })
      .finally(() => setPendingTaxonomyCreateType(null));
  }

  function toggleTheme(theme: string) {
    setForm((prev) => {
      const current = parseThemeList(prev.theme);
      const next = current.includes(theme)
        ? current.filter((item) => item !== theme)
        : [...current, theme];
      return { ...prev, theme: stringifyThemeList(next) };
    });
  }

  function addCustomTheme() {
    const value = newThemeInput.trim();
    if (!value) return;
    setPendingTaxonomyCreateType("theme");
    fetch("/api/admin/product-taxonomies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "theme", name: value }),
    })
      .then(async (response) => {
        const result = (await response.json()) as { message?: string };
        if (!response.ok) {
          showToast("error", result.message ?? "테마 추가에 실패했습니다.");
          return;
        }
        setForm((prev) => {
          const current = parseThemeList(prev.theme);
          if (current.includes(value)) return prev;
          return { ...prev, theme: stringifyThemeList([...current, value]) };
        });
        setNewThemeInput("");
        showToast("success", "테마를 추가했습니다.");
        await loadTaxonomies();
      })
      .catch(() => {
        showToast("error", "테마 추가 중 오류가 발생했습니다.");
      })
      .finally(() => setPendingTaxonomyCreateType(null));
  }

  async function handleDeleteTaxonomy(item: ProductTaxonomyWithUsage) {
    const confirmed = window.confirm(`'${item.name}' 항목을 삭제할까요?`);
    if (!confirmed) return;
    setPendingTaxonomyDeleteId(item.id);
    try {
      const response = await fetch(`/api/admin/product-taxonomies/${item.id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        showToast("error", result.message ?? "삭제에 실패했습니다.");
        return;
      }
      showToast("success", "항목을 삭제했습니다.");
      await loadTaxonomies();
    } catch {
      showToast("error", "삭제 중 오류가 발생했습니다.");
    } finally {
      setPendingTaxonomyDeleteId(null);
    }
  }

  async function quickToggleActive(product: Product) {
    setPendingToggleId(product.id);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !(product.is_active ?? true) }),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        showToast("error", result.message ?? "활성화 상태 변경에 실패했습니다.");
        return;
      }

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, is_active: !(item.is_active ?? true) } : item,
        ),
      );
      showToast("success", "상품 활성화 상태를 변경했습니다.");
    } catch {
      showToast("error", "활성화 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingToggleId(null);
    }
  }

  async function quickToggleFeaturedHome(product: Product) {
    if (!product.is_featured_home && featuredCount >= FEATURED_PRODUCT_LIMIT) {
      showToast("error", `메인 추천상품은 최대 ${FEATURED_PRODUCT_LIMIT}개까지 설정할 수 있습니다.`);
      return;
    }

    setPendingFeaturedToggleId(product.id);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_featured_home: !Boolean(product.is_featured_home) }),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        showToast("error", result.message ?? "메인 추천 상태 변경에 실패했습니다.");
        return;
      }

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                is_featured_home: !Boolean(item.is_featured_home),
                is_active: !Boolean(item.is_featured_home) ? true : item.is_active,
              }
            : item,
        ),
      );
      showToast("success", "메인 추천 상태를 변경했습니다.");
    } catch {
      showToast("error", "메인 추천 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingFeaturedToggleId(null);
    }
  }

  async function moveSortOrder(product: Product, direction: "up" | "down") {
    const sameBucket = products.filter(
      (item) => Boolean(item.is_featured_home) === Boolean(product.is_featured_home),
    );
    const currentIndex = sameBucket.findIndex((item) => item.id === product.id);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sameBucket.length) return;

    const target = sameBucket[targetIndex];
    const currentOrder = typeof product.sort_order === "number" ? product.sort_order : currentIndex + 1;
    const targetOrder = typeof target.sort_order === "number" ? target.sort_order : targetIndex + 1;

    setPendingMoveId(product.id);
    try {
      const first = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: targetOrder }),
      });
      const firstResult = (await first.json()) as { message?: string };
      if (!first.ok) {
        showToast("error", firstResult.message ?? "노출순서 변경에 실패했습니다.");
        return;
      }

      const second = await fetch(`/api/admin/products/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: currentOrder }),
      });
      const secondResult = (await second.json()) as { message?: string };
      if (!second.ok) {
        showToast("error", secondResult.message ?? "노출순서 변경에 실패했습니다.");
        return;
      }

      showToast("success", "노출순서를 변경했습니다.");
      await loadProducts();
    } catch {
      showToast("error", "노출순서 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingMoveId(null);
    }
  }

  return (
    <div className="space-y-6">
      {isTaxonomyView && (
        <section className="space-y-3 rounded-xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--border)]">
          <h3 className="text-lg font-bold text-[var(--primary)]">카테고리/테마 관리</h3>
          {taxonomyErrorMessage ? <p className="text-sm text-[var(--danger)]">{taxonomyErrorMessage}</p> : null}
          {isTaxonomyLoading ? (
            <p className="text-sm text-[var(--text-muted)]">분류 목록을 불러오는 중입니다...</p>
          ) : (
            <div className="space-y-3">
              {taxonomyItems.some((item) => item.id.startsWith("fallback-")) ? (
                <p className="text-xs text-amber-700">
                  분류 전용 테이블이 없어 임시 목록으로 표시 중입니다. SQL 적용 후 추가/삭제가 완전 활성화됩니다.
                </p>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">카테고리</p>
                  <div className="flex flex-wrap gap-2">
                    {categoryTaxonomies.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"
                      >
                        {item.name}
                        <span className="text-[10px] text-blue-600">({item.usageCount})</span>
                        <button
                          type="button"
                          disabled={pendingTaxonomyDeleteId === item.id || item.id.startsWith("fallback-")}
                          onClick={() => handleDeleteTaxonomy(item)}
                          className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-1.5 py-0.5 text-[10px] text-[var(--danger)] ring-1 ring-[var(--danger)]/30 hover:opacity-90 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={newCategoryInput}
                      onChange={(event) => setNewCategoryInput(event.target.value)}
                      placeholder="카테고리 직접 추가"
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <button
                      type="button"
                      onClick={addCustomCategory}
                      disabled={pendingTaxonomyCreateType === "category"}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
                    >
                      {pendingTaxonomyCreateType === "category" ? "추가 중..." : "추가"}
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">테마</p>
                  <div className="flex flex-wrap gap-2">
                    {themeTaxonomies.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                      >
                        {item.name}
                        <span className="text-[10px] text-amber-600">({item.usageCount})</span>
                        <button
                          type="button"
                          disabled={pendingTaxonomyDeleteId === item.id || item.id.startsWith("fallback-")}
                          onClick={() => handleDeleteTaxonomy(item)}
                          className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-1.5 py-0.5 text-[10px] text-[var(--danger)] ring-1 ring-[var(--danger)]/30 hover:opacity-90 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={newThemeInput}
                      onChange={(event) => setNewThemeInput(event.target.value)}
                      placeholder="테마 직접 추가 (예: 가족여행)"
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <button
                      type="button"
                      onClick={addCustomTheme}
                      disabled={pendingTaxonomyCreateType === "theme"}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
                    >
                      {pendingTaxonomyCreateType === "theme" ? "추가 중..." : "추가"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {isCreateView || editingId ? (
        <>
        {/* lg 미만: 입력 | 카드 | 상세 탭 */}
        <div className="lg:hidden mb-4">
          <Tabs value={smallScreenTab} onChange={(v) => setSmallScreenTab(v as "input" | "card" | "detail")}>
            <TabsTrigger value="input">입력</TabsTrigger>
            <TabsTrigger value="card">카드</TabsTrigger>
            <TabsTrigger value="detail">상세</TabsTrigger>
          </Tabs>
        </div>

        <div className="lg:grid lg:grid-cols-[1fr,minmax(300px,400px)] lg:gap-6 space-y-4 lg:space-y-0">
          {/* 좌측: 네비(aside) + 폼(main) — md부터 좌측 네비 2컬럼, 네비 sticky */}
          <div className={smallScreenTab === "input" ? "block" : "hidden lg:block"} aria-hidden={smallScreenTab !== "input"}>
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(200px,240px),1fr] md:gap-4">
          {/* 좌측 세로 네비 — md 이상에서 왼쪽 고정, sticky로 스크롤 따라다님 */}
          <aside className="hidden md:block w-full md:min-h-0" aria-label="폼 섹션 목차 영역">
            <div
              className="sticky z-10 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain"
              style={{ top: "var(--product-form-nav-top, 6rem)" }}
            >
              <ProductFormSectionNav
                sections={SECTIONS.map((s) => ({ id: s.id, title: s.title }))}
                activeSectionId={activeSectionId}
                setActiveSectionId={(id) => setActiveSectionId(id as SectionId)}
                openSection={(id, anchorId) =>
                  openSectionAndScrollTo(id as SectionId, anchorId)
                }
                issues={formIssuesForBar}
              />
            </div>
          </aside>
          <main className="min-w-0">
        <form
          className="space-y-4 rounded-xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--border)]"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--primary)]">{editingId ? "상품 수정" : "상품 등록"}</h3>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(initialFormState);
                setActiveSchedulePreviewIndex(0);
                setShowRawScheduleEditor(false);
                setScheduleEditorMode("visual");
                setErrorMessage("");
              }}
              className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              수정 취소
            </button>
          ) : null}
        </div>

        {showDraftBanner && draftData && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-amber-800 dark:text-amber-200">
              임시 저장본이 있습니다 ({new Date(draftData.savedAt).toLocaleString("ko-KR")})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
              >
                복원
              </button>
              <button
                type="button"
                onClick={handleDismissDraft}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                무시
              </button>
            </div>
          </div>
        )}

        <ProductFormActionBar
          sections={SECTIONS.map((s) => ({ id: s.id, title: s.title }))}
          openSections={productFormOpenSections}
          setOpenSections={setProductFormOpenSections}
          issues={formIssuesForBar}
          onSave={submit}
          onTempSave={handleSaveDraft}
          onPreviewClick={handlePreviewClick}
          hasTempDraft={showDraftBanner && !!draftData}
          isSaving={isSubmitting}
          isSavingDraft={isSavingDraft}
          isEditing={Boolean(editingId)}
        />

        <div className="space-y-2">
          {SECTIONS.map((section) => {
            const id = section.id;
            const issues = sectionIssuesBySection[id] ?? [];
            const requiredCount = issues.filter((i) => i.severity === "required").length;
            const recommendedCount = issues.filter((i) => i.severity === "recommended").length;
            const badgeLabel =
              requiredCount === 0 && recommendedCount === 0
                ? "완료"
                : requiredCount > 0
                  ? `필수 ${requiredCount}개`
                  : `권장 ${recommendedCount}개`;
            const badgeVariant =
              requiredCount > 0 ? "required" : recommendedCount > 0 ? "recommended" : "complete";
            return (
            <div
              key={id}
              id={`form-section-${id}`}
              className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] ring-1 ring-[var(--border)]"
            >
              <button
                type="button"
                onClick={() => openSectionAndScrollTo(id as SectionId)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]"
              >
                <span className="flex items-center gap-2">
                  {requiredCount > 0 ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
                  ) : null}
                  {section.title}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      badgeVariant === "complete"
                        ? "bg-[var(--success)]/20 text-[var(--success)]"
                        : badgeVariant === "required"
                          ? "bg-[var(--danger)]/20 text-[var(--danger)]"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {badgeLabel}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 transition ${productFormOpenSections[id] ? "rotate-180" : ""}`}
                  />
                </span>
              </button>
              <div
                className={productFormOpenSections[id] ? "block" : "hidden"}
                aria-hidden={!productFormOpenSections[id]}
              >
                <div className="border-t border-[var(--divider)] p-4">
                  {issues.length > 0 ? (
                    <ProductFormSectionIssuesPanel
                      sectionId={id}
                      sectionIssues={issues}
                      onIssueClick={(anchorId) =>
                        openSectionAndScrollTo(id as SectionId, anchorId ?? undefined)
                      }
                    />
                  ) : null}
                  {id === "basic" && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-wrap items-center gap-2">
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
            placeholder="상품명"
            id="field-product-name"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <button
            type="button"
            onClick={() => {
              setTitleExtractPaste("");
              setTitleCandidates([]);
              setShowTitleExtractModal(true);
            }}
            className="shrink-0 rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
          >
            상품명 추출
          </button>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">한 줄 소개 (상세 상단 요약)</label>
            <input
              value={form.one_liner}
              onChange={(event) => setForm((prev) => ({ ...prev, one_liner: event.target.value }))}
              placeholder="비우면 상품 설명 첫 줄 사용"
              id="form-field-basic-one_liner"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {categoryOptions.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  카테고리를 먼저 추가해 주세요
                </span>
              ) : (
                categoryOptions.map((category) => {
                  const selected = form.category === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, category }))}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        selected
                          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                          : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newCategoryInput}
                onChange={(event) => setNewCategoryInput(event.target.value)}
                placeholder="카테고리 직접 추가"
                id="form-field-basic-category"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
              <button
                type="button"
                onClick={addCustomCategory}
                disabled={pendingTaxonomyCreateType === "category"}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
              >
                {pendingTaxonomyCreateType === "category" ? "추가 중..." : "추가"}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {availableThemeOptions.map((theme) => {
                const selected = selectedThemes.includes(theme);
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => toggleTheme(theme)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      selected
                        ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                        : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    {theme}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newThemeInput}
                onChange={(event) => setNewThemeInput(event.target.value)}
                placeholder="테마 직접 추가 (예: 가족여행)"
                id="form-field-basic-theme"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
              <button
                type="button"
                onClick={addCustomTheme}
                disabled={pendingTaxonomyCreateType === "theme"}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
              >
                {pendingTaxonomyCreateType === "theme" ? "추가 중..." : "추가"}
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">선택된 테마: {selectedThemes.join(", ") || "-"}</p>
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 md:col-span-2">
              <p className="text-xs font-medium text-blue-900">여행 오버뷰 품질 가이드</p>
              <p className="mt-0.5 text-xs text-blue-800">
                카테고리·테마는 상세 첫 화면의 여행 오버뷰 &quot;지역&quot; 카드에 반영됩니다. 대표 이미지는 오버뷰 커버로 사용됩니다.
              </p>
            </div>
            <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 md:col-span-2">
              <p className="text-xs font-semibold text-[var(--text-primary)]">여행 오버뷰 카드 (숙소·지역·기간)</p>
              <p className="text-xs text-[var(--text-muted)]">
                상세 페이지 첫 화면에 표시되는 카드 값입니다. 비우면 기존 자동 추출(meta_info, theme, duration)을 사용합니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">숙소</label>
                  <input
                    value={form.overview_accommodation}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_accommodation: e.target.value }))
                    }
                    placeholder="예: 상담 시 안내, 전일정4성"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">지역</label>
                  <input
                    value={form.overview_region}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_region: e.target.value }))
                    }
                    placeholder="예: 호주, 동남아"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">기간</label>
                  <input
                    value={form.overview_duration}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_duration: e.target.value }))
                    }
                    placeholder="예: 6일, 3박4일"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">일정 테마 구성비 (상세 오버뷰 차트)</p>
            <p className="text-xs text-[var(--text-muted)]">
              2개 이상 입력 시 상세 페이지에 도넛 차트로 표시됩니다. 미입력 시 카테고리·테마 기반으로 자동 생성됩니다.
            </p>
            <div className="space-y-2">
              {form.theme_chart_json.map((item, idx) => (
                <div
                  key={idx}
                  className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2"
                >
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        theme_chart_json: prev.theme_chart_json.map((x, i) =>
                          i === idx ? { ...x, label: e.target.value } : x,
                        ),
                      }))
                    }
                    placeholder="항목명 (예: 자연)"
                    className="flex-1 min-w-[80px] rounded border border-[var(--border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.percent}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v))
                        setForm((prev) => ({
                          ...prev,
                          theme_chart_json: prev.theme_chart_json.map((x, i) =>
                            i === idx ? { ...x, percent: Math.max(0, Math.min(100, v)) } : x,
                          ),
                        }));
                    }}
                    placeholder="%"
                    className="w-16 rounded border border-[var(--border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">%</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        theme_chart_json: prev.theme_chart_json.filter((_, i) => i !== idx),
                      }))
                    }
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    삭제
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    theme_chart_json: [...prev.theme_chart_json, { label: "", percent: 0 }],
                  }))
                }
                className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                + 항목 추가
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">상품 상태 (카드/상세 태그)</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "AVAILABLE", label: "예약 가능" },
                { value: "LIMITED", label: "잔여 한정" },
                { value: "SOLD_OUT", label: "마감" },
                { value: "CONSULT_REQUIRED", label: "상담 후 안내" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, status: opt.value as ProductFormState["status"] }))
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    form.status === opt.value
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2" id="field-product-cover-image" tabIndex={0}>
            <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">대표 이미지</p>
              {form.image_url?.trim() || form.images_json.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded border-2 border-[var(--primary)] bg-[var(--surface-muted)]">
                    <img
                      src={normalizeProductImageUrl(form.image_url?.trim() || form.images_json[0] || "")}
                      alt="대표"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-primary)]">
                      현재 대표: {form.image_url?.trim() ? "지정됨" : "첫 번째 이미지"}
                    </p>
                    <button
                      type="button"
                      onClick={openCoverRecommendModal}
                      className="mt-1 rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                    >
                      대표 이미지 추천 보기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">대표 이미지 미지정</span>
                  <button
                    type="button"
                    onClick={openCoverRecommendModal}
                    className="rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                  >
                    대표 이미지 추천 보기
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">상품 이미지 (여러 장)</p>
            <MultiImageUploadField
              value={form.images_json}
              primaryImageUrl={form.image_url?.trim() || form.images_json[0] || undefined}
              onChange={(urls) =>
                setForm((prev) => ({
                  ...prev,
                  images_json: urls,
                  image_url: prev.image_url?.trim() || (urls[0] ?? ""),
                }))
              }
              selectedEvent={selectedEvent}
              onAddToEvent={(url) => {
                const added = addProductImageToSelectedEvent(url);
                if (added) showToast("success", "이벤트에 이미지 추가됨");
                else if (selectedEvent) showToast("warning", "이미 해당 이벤트에 등록된 이미지입니다.");
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]">
                미리보기용 이미지 파일 선택
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setPreviewImageFile(file ?? null);
                  }}
                />
              </label>
              {previewImageFile && (
                <span className="text-xs text-[var(--text-secondary)]">
                  {previewImageFile.name}
                  <button
                    type="button"
                    onClick={() => setPreviewImageFile(null)}
                    className="ml-1 text-[var(--danger)] hover:underline"
                  >
                    해제
                  </button>
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <p className="text-xs font-semibold text-[var(--success)]">관리자 전용 | 상품 원본주소</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={form.product_source_url}
                onChange={(event) => setForm((prev) => ({ ...prev, product_source_url: event.target.value }))}
                placeholder="상품 원본주소 (관리자 확인용 URL)"
                className="min-w-0 flex-1 rounded-lg border border-[var(--success)]/30 bg-[var(--success-bg)]/40 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(BOOKMARKLET_EXTRACT_IMAGE_URLS);
                    showToast("success", "북마클릿이 복사되었습니다. 사용법은 [!] 버튼을 참고하세요.");
                  } catch {
                    showToast("error", "클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
                  }
                }}
                className="shrink-0 rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
              >
                이미지 추출 도구
              </button>
              <button
                type="button"
                onClick={() => setShowImageImportGuideModal(true)}
                className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                title="이미지 자동 등록 사용법"
              >
                [!]
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              1) 버튼 눌러 북마클릿 복사 → 2) 브라우저 북마크 URL에 붙여넣기 → 3) 모두투어 등 원본 페이지에서 북마클릿 실행 → URL 복사됨 → 4) 아래 상품 이미지 또는 이벤트 이미지 입력란에 붙여넣기
            </p>
          </div>
                  </div>
                  )}
                  {id === "price" && (
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={form.price}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, price: formatPriceWithCommas(event.target.value) }))
            }
            placeholder="가격(숫자)"
            id="field-price-main"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <input
            value={form.duration}
            onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))}
            placeholder="일정(예: 5일)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <p className="text-xs text-[var(--text-muted)] md:col-span-2">일정 값은 여행 오버뷰 &quot;기간&quot; 카드에 반영됩니다.</p>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">가격 기준 문구</label>
            <input
              value={form.price_meta}
              onChange={(event) => setForm((prev) => ({ ...prev, price_meta: event.target.value }))}
              placeholder="예: 1인 기준 (비우면 기본값 1인 기준)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">유류할증료 문구</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "", label: "표시 안 함" },
                { value: "true", label: "유류할증료 포함" },
                { value: "false", label: "유류할증료 별도" },
              ].map((opt) => (
                <button
                  key={opt.value || "none"}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, fuel_included: opt.value as "" | "true" | "false" }))
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    form.fuel_included === opt.value
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">카드 메타 문구 (일정·지역 옆 표시)</label>
            <input
              value={form.meta_info}
              onChange={(event) => setForm((prev) => ({ ...prev, meta_info: event.target.value }))}
              placeholder="예: 항공 포함"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              이 값은 상세 첫 화면 여행 오버뷰의 &quot;숙소&quot;·&quot;기타&quot; 카드에 반영될 수 있습니다. (예: 전일정4성, 호텔 등)
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">상품 옵션 (기간·룸 등 선택 시 견적)</p>
            <p className="text-xs text-[var(--text-muted)]">
              JSON 형식. 비우면 옵션 미사용. basePrice, currency, requiredGroups(선택), groups 배열 필수.
            </p>
            <textarea
              value={form.options_json}
              onChange={(event) => setForm((prev) => ({ ...prev, options_json: event.target.value }))}
              rows={8}
              placeholder='{"basePrice": 1000000, "currency": "KRW", "requiredGroups": ["period"], "groups": [{"key": "period", "title": "기간", "type": "radio", "items": [{"value": "3n4d", "label": "3박4일", "priceDelta": 0, "isDefault": true}, {"value": "4n5d", "label": "4박5일", "priceDelta": 200000}]}]}'
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
                  </div>
                  )}
                  {id === "description" && (
        <div className="grid gap-3 md:grid-cols-2">
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            required
            rows={4}
            placeholder="상품 설명"
            id="field-product-description"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <textarea
            value={form.point_benefits}
            onChange={(event) => setForm((prev) => ({ ...prev, point_benefits: event.target.value }))}
            rows={3}
            placeholder="상품 포인트 - 혜택 (줄바꿈 가능)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 p-3 md:col-span-2">
            <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">상품 포인트 O/X 선택</p>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { key: "travel_insurance", label: "상품 포인트 - 여행자보험" },
                { key: "meeting_info", label: "상품 포인트 - 미팅 정보" },
                { key: "point_tourism", label: "상품 포인트 - 관광" },
                { key: "point_guide", label: "상품 포인트 - 인솔자" },
              ].map((field) => {
                const fieldKey = field.key as
                  | "travel_insurance"
                  | "meeting_info"
                  | "point_tourism"
                  | "point_guide";
                const value = form[fieldKey];
                return (
                  <div key={field.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">{field.label}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, [fieldKey]: "O" }))}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          value === "O"
                            ? "bg-emerald-600 text-white"
                            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        O
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, [fieldKey]: "X" }))}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          value === "X"
                            ? "bg-rose-600 text-white"
                            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        X
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
                  </div>
                  )}
                  {id === "included" && (
        <div className="grid gap-3 md:grid-cols-2">
          <textarea
            value={form.included_items}
            onChange={(event) => setForm((prev) => ({ ...prev, included_items: event.target.value }))}
            rows={3}
            placeholder="포함사항 (줄바꿈 가능)"
            id="field-included"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <textarea
            value={form.excluded_items}
            onChange={(event) => setForm((prev) => ({ ...prev, excluded_items: event.target.value }))}
            rows={3}
            placeholder="불포함사항 (줄바꿈 가능)"
            id="field-excluded"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start md:col-span-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">선택관광 목록 (줄바꿈 가능)</label>
              <textarea
                value={form.optional_tours}
                onChange={(event) => setForm((prev) => ({ ...prev, optional_tours: event.target.value }))}
                rows={4}
                placeholder="선택관광 목록 (줄바꿈 가능)"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            </div>
            <div className="w-full sm:w-48 shrink-0">
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">출발인원 (~명 이상)</label>
              <input
                type="text"
                value={form.min_departure_people}
                onChange={(event) => setForm((prev) => ({ ...prev, min_departure_people: event.target.value }))}
                placeholder="예: 10"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            </div>
          </div>
                  </div>
                  )}
                  {id === "flight" && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">항공편 정보</p>
            <p className="text-xs text-[var(--text-secondary)]">
              출발/도착 공항·편명은 상세 첫 화면 여행 오버뷰의 &quot;항공&quot; 카드에 자동 반영됩니다.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              현재는 라이선스 문제로 실제 항공사 로고 이미지는 사용하지 않고, 아이콘 + 텍스트만 표시됩니다. 추후
              라이선스 획득 시 이 프리뷰 영역과 상세페이지에 로고가 자동 업데이트됩니다.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">출발 항공편</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={form.departure_from_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_airport: event.target.value }))
                    }
                    placeholder="출발공항 (예: 인천 ICN)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_airport: event.target.value }))
                    }
                    placeholder="도착공항 (예: 미야자키 KMI)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_from_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_date: event.target.value }))
                    }
                    placeholder="출발일자 (예: 2026.02.20(금))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_date: event.target.value }))
                    }
                    placeholder="도착일자 (예: 2026.02.20(금))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_from_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_time: event.target.value }))
                    }
                    placeholder="출발시각 (예: 09:40)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_time: event.target.value }))
                    }
                    placeholder="도착시각 (예: 11:20)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <input
                      value={form.departure_flight_name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, departure_flight_name: event.target.value }))
                      }
                      placeholder="항공편명 (예: 아시아나항공, 티웨이항공 TW501)"
                      id="form-field-flight-departure_flight_name"
                      className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <AirlineLogo airlineText={form.departure_flight_name} size={32} />
                  </div>
                  <input
                    value={form.departure_baggage_limit}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_baggage_limit: event.target.value }))
                    }
                    placeholder="수하물 한도 (예: 23 또는 23KG)"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  {/* 현재는 항상 Plane + 텍스트만 표시 (로고 비활성화) */}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">도착 항공편</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={form.arrival_from_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_airport: event.target.value }))
                    }
                    placeholder="출발공항 (예: 미야자키 KMI)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_airport: event.target.value }))
                    }
                    placeholder="도착공항 (예: 인천 ICN)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_from_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_date: event.target.value }))
                    }
                    placeholder="출발일자 (예: 2026.02.23(월))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_date: event.target.value }))
                    }
                    placeholder="도착일자 (예: 2026.02.23(월))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_from_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_time: event.target.value }))
                    }
                    placeholder="출발시각 (예: 12:30)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_time: event.target.value }))
                    }
                    placeholder="도착시각 (예: 14:10)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <input
                      value={form.arrival_flight_name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, arrival_flight_name: event.target.value }))
                      }
                      placeholder="항공편명 (예: 아시아나항공, 티웨이항공 TW501)"
                      id="form-field-flight-arrival_flight_name"
                      className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <AirlineLogo airlineText={form.arrival_flight_name} size={32} />
                  </div>
                  <input
                    value={form.arrival_baggage_limit}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_baggage_limit: event.target.value }))
                    }
                    placeholder="수하물 한도 (예: 23 또는 23KG)"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  {/* 현재는 항상 Plane + 텍스트만 표시 (로고 비활성화) */}
                </div>
              </div>
            </div>
          </div>
                  </div>
                  )}
                  {id === "schedule" && (
        <div className="space-y-3" id="field-schedule-root" tabIndex={-1}>
          {selectedEvent && getSelectedEventLabel() && (
            <div className="rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)]/40 px-3 py-2">
              <p className="text-sm font-semibold text-[var(--primary)]">
                현재 이미지 추가 대상: {getSelectedEventLabel()}
              </p>
            </div>
          )}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3">
            <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">붙여넣기로 이미지 추가 (Paste-to-Add)</p>
            <textarea
              value={pasteToAddValue}
              onChange={(e) => setPasteToAddValue(e.target.value)}
              placeholder="북마클릿으로 복사한 URL을 여기에 붙여넣으세요 (줄바꿈·쉼표 구분)"
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={selectedEvent == null}
                onClick={() => {
                  if (selectedEvent == null) return;
                  const count = addImagesToEvent(selectedEvent, [pasteToAddValue]);
                  setPasteToAddValue("");
                  if (count > 0) showToast("success", `선택 이벤트에 ${count}개 이미지 추가됨`);
                  else showToast("warning", "추가할 수 있는 URL이 없습니다. (중복 또는 비허용 URL)");
                }}
                className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                선택 이벤트에 추가
              </button>
              {selectedEvent == null && (
                <span className="text-xs text-[var(--text-muted)]">
                  먼저 아래 일정에서 &quot;이 이벤트에 추가 대상&quot;을 선택하세요.
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--divider)] pb-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">일정 입력 방식</span>
            <div className="flex rounded-lg border border-[var(--border)] bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setScheduleEditorMode("visual")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  scheduleEditorMode === "visual"
                    ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-slate-900"
                }`}
              >
                시각화 일정(권장)
              </button>
              <button
                type="button"
                onClick={() => setScheduleEditorMode("legacy")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  scheduleEditorMode === "legacy"
                    ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-slate-900"
                }`}
              >
                레거시 텍스트(기존)
              </button>
            </div>
          </div>

          {scheduleEditorMode === "visual" ? (
            <ScheduleVisualEditorV2
              form={form}
              setForm={setForm}
              previewProductImageUrl={previewImageObjectUrl ?? form.images_json[0] ?? form.image_url ?? ""}
              activeDayIndex={activeSchedulePreviewIndex}
              setActiveDayIndex={setActiveSchedulePreviewIndex}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
            />
          ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--primary)]">상세일정 작성 도우미</p>
                <p className="text-xs text-[var(--text-muted)]">일차별로 작성하면 자동으로 탭 형식으로 저장됩니다.</p>
                <p className="mt-0.5 text-xs text-blue-700">이 일정은 상세 첫 화면의 여행 오버뷰 타임라인에도 자동 반영됩니다.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addScheduleDay}
                  className="rounded-lg border border-[var(--primary)]/30 bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]"
                >
                  + 일차 추가
                </button>
                <button
                  type="button"
                  onClick={() => setShowRawScheduleEditor((prev) => !prev)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  {showRawScheduleEditor ? "원문 편집 숨기기" : "원문 직접 편집"}
                </button>
              </div>
            </div>

            {!showRawScheduleEditor ? (
              <StructuredDaysEditor
                days={form.itinerary_days_json}
                onDaysChange={(updater) =>
                  setForm((prev) => ({ ...prev, itinerary_days_json: updater(prev.itinerary_days_json) }))
                }
                onDayFocus={setActiveSchedulePreviewIndex}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
              />
            ) : (
            <>
            {scheduleDrafts.length === 0 ? (
              <button
                type="button"
                onClick={addScheduleDay}
                className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-6 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                일차를 추가하고 상세일정을 입력해 주세요
              </button>
            ) : (
              <div className="space-y-3">
                {scheduleDrafts.map((item, index) => (
                  <article key={`${item.label}-${index}`} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input
                        value={item.label}
                        onFocus={() => setActiveSchedulePreviewIndex(index)}
                        onChange={(event) =>
                          updateScheduleDrafts((current) =>
                            current.map((draft, draftIndex) =>
                              draftIndex === index ? { ...draft, label: event.target.value } : draft,
                            ),
                          )
                        }
                        placeholder="예: 1일차"
                        className="w-28 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() =>
                            updateScheduleDrafts((current) => {
                              if (index <= 0) return current;
                              const next = [...current];
                              const target = next[index];
                              next[index] = next[index - 1];
                              next[index - 1] = target;
                              return next;
                            })
                          }
                          className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-primary)] disabled:opacity-40"
                        >
                          위로
                        </button>
                        <button
                          type="button"
                          disabled={index >= scheduleDrafts.length - 1}
                          onClick={() =>
                            updateScheduleDrafts((current) => {
                              if (index >= current.length - 1) return current;
                              const next = [...current];
                              const target = next[index];
                              next[index] = next[index + 1];
                              next[index + 1] = target;
                              return next;
                            })
                          }
                          className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-primary)] disabled:opacity-40"
                        >
                          아래로
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateScheduleDrafts((current) =>
                              current.filter((_, draftIndex) => draftIndex !== index),
                            );
                            setActiveSchedulePreviewIndex((prev) =>
                              prev > index ? prev - 1 : Math.max(0, Math.min(prev, scheduleDrafts.length - 2)),
                            );
                          }}
                          className="rounded border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={item.content}
                      onFocus={() => setActiveSchedulePreviewIndex(index)}
                      onChange={(event) =>
                        updateScheduleDrafts((current) =>
                          current.map((draft, draftIndex) =>
                            draftIndex === index ? { ...draft, content: event.target.value } : draft,
                          ),
                        )
                      }
                      rows={5}
                      placeholder="해당 일차의 일정을 입력해 주세요."
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[
                        { label: "TEE OFF", text: "▷TEE OFF TIME: " },
                        { label: "식사", text: "▷식사: " },
                        { label: "이동", text: "▷이동: " },
                        { label: "호텔", text: "▷숙소: " },
                      ].map((template) => (
                        <button
                          key={template.label}
                          type="button"
                          onClick={() => appendScheduleTemplate(index, template.text)}
                          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                        >
                          + {template.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}

            </>
            )}

            {effectiveDayCount > 0 ? (
              <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--surface)] p-4">
                <p className="mb-2 text-xs font-semibold text-blue-700">실시간 미리보기</p>
                <div className="mb-2 inline-flex items-center rounded-full bg-[#eff6ff] px-2.5 py-1 text-xs font-bold text-[#1d4ed8]">
                  {form.itinerary_days_json.length > 0
                    ? form.itinerary_days_json[activeSchedulePreviewIndex]?.title || `Day ${(form.itinerary_days_json[activeSchedulePreviewIndex]?.day ?? activeSchedulePreviewIndex + 1)}`
                    : scheduleDrafts[activeSchedulePreviewIndex]?.label || `${activeSchedulePreviewIndex + 1}일차`}
                </div>
                <p className="whitespace-pre-line text-sm leading-7 text-[var(--text-primary)]">
                  {form.itinerary_days_json.length > 0
                    ? (form.itinerary_days_json[activeSchedulePreviewIndex]?.events ?? [])
                        .map((e) => (e.description ? `${e.heading}: ${e.description}` : e.heading))
                        .join("\n") || "입력한 일정이 여기에 표시됩니다."
                    : scheduleDrafts[activeSchedulePreviewIndex]?.content || "입력한 일정이 여기에 표시됩니다."}
                </p>
              </div>
            ) : null}

            {effectiveDayCount > 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">Day별 대표 이미지 (선택)</p>
                <p className="mb-3 text-xs text-[var(--text-muted)]">
                  일차별로 업로드하거나 URL을 넣으면 상세 일정 타임라인에 표시됩니다. 비우면 상품 대표 이미지로 대체됩니다.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: effectiveDayCount }, (_, i) => i + 1).map((dayNum) => {
                    const dayKey = String(dayNum);
                    const url = form.itinerary_media_json[dayKey] ?? "";
                    return (
                      <div key={dayKey} className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">Day {dayNum}</p>
                        <ImageUploadField
                          value={url}
                          onChange={(v) =>
                            setForm((prev) => ({
                              ...prev,
                              itinerary_media_json: { ...prev.itinerary_media_json, [dayKey]: v },
                            }))
                          }
                          onUploaded={(v) =>
                            setForm((prev) => ({
                              ...prev,
                              itinerary_media_json: { ...prev.itinerary_media_json, [dayKey]: v },
                            }))
                          }
                          uploadedUrlKey="card"
                          optional
                          placeholder="Day 이미지 URL 또는 업로드"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {showRawScheduleEditor ? (
              <textarea
                value={form.detailed_schedule}
                onChange={(event) => setForm((prev) => ({ ...prev, detailed_schedule: event.target.value }))}
                rows={8}
                placeholder={"원문 직접 편집\n예시:\n[1일차]\n인천 출발 / 하노이 도착\n...\n\n[2일차]\n하노이 시내관광\n..."}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            ) : null}
          </div>
        </div>
          )}
        </div>
                  )}
                  {id === "terms" && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">약관 및 참조사항 템플릿 적용</p>
            <select
              value={form.terms_template_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  terms_template_type: event.target.value as "" | TermsTemplateType,
                }))
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value="">직접 입력 (템플릿 미사용)</option>
              {TERMS_TEMPLATE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {form.terms_template_type ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">선택 템플릿 미리보기</p>
                <p className="whitespace-pre-line text-xs leading-6 text-[var(--text-secondary)]">
                  {selectedTermsTemplateContent.trim() || "템플릿 내용이 비어 있습니다. 아래에서 수정해 주세요."}
                </p>
              </div>
            ) : null}
            <textarea
              value={form.terms_and_notes}
              onChange={(event) => setForm((prev) => ({ ...prev, terms_and_notes: event.target.value }))}
              rows={4}
              placeholder="약관 및 참조사항 직접 입력 (템플릿 미사용 시 적용)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">약관 템플릿 관리 (공통)</p>
              <button
                type="button"
                onClick={() => setIsTermsTemplatesPanelOpen((prev) => !prev)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
              >
                {isTermsTemplatesPanelOpen ? "접기" : "펼치기"}
              </button>
            </div>
            {!isTermsTemplatesPanelOpen ? (
              <p className="text-xs text-[var(--text-muted)]">
                안전을 위해 기본 접힘 상태입니다. 수정이 필요할 때만 펼쳐서 사용해 주세요.
              </p>
            ) : (
              <>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveTermsTemplates}
                    disabled={isTermsTemplatesLoading || isTermsTemplatesSaving}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                  >
                    {isTermsTemplatesSaving ? "저장 중..." : "템플릿 저장"}
                  </button>
                </div>
                {termsTemplatesErrorMessage ? (
                  <p className="text-xs text-rose-600">{termsTemplatesErrorMessage}</p>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  {TERMS_TEMPLATE_OPTIONS.map((item) => (
                    <div key={item.value} className="space-y-1 rounded-lg border border-[var(--border)] bg-slate-50 p-2.5">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{item.label}</p>
                      <textarea
                        value={termsTemplates[item.value]}
                        onChange={(event) =>
                          setTermsTemplates((prev) => ({
                            ...prev,
                            [item.value]: event.target.value,
                          }))
                        }
                        rows={5}
                        placeholder={`${item.label} 약관 템플릿을 입력하세요.`}
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <input
            value={form.meta_title}
            onChange={(event) => setForm((prev) => ({ ...prev, meta_title: event.target.value }))}
            placeholder="SEO 메타 타이틀 (선택). 스페이스로 구분한 키워드는 상품 상세페이지에 해시태그(#키워드)로 노출됩니다. 예: 태국 파크골프 치앙마이"
            id="field-seo-title"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <textarea
            value={form.meta_description}
            onChange={(event) => setForm((prev) => ({ ...prev, meta_description: event.target.value }))}
            rows={3}
            placeholder="SEO 메타 설명 (선택, 예시: 타깃층 문제해결 + 차별화된 혜택/신뢰 요소 + CTA포함)"
            id="field-seo-desc"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <input
            value={form.sort_order}
            onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
            placeholder="노출 순서 (숫자 작을수록 먼저)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                          className="h-4 w-4 accent-[var(--primary)]"
            />
            상품 노출 활성화
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              id="field-main-reco"
              type="checkbox"
              checked={form.is_featured_home}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, is_featured_home: event.target.checked }))
              }
                          className="h-4 w-4 accent-[var(--primary)]"
            />
            메인 추천상품 슬라이드 노출 (최대 {FEATURED_PRODUCT_LIMIT}개)
          </label>
        </div>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={isSubmitting}
            className="rounded-lg bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
          >
            {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "상품 등록"}
          </button>
          {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
          <span className="text-xs text-[var(--text-muted)]">
            메인 추천 설정: {featuredCount}/{FEATURED_PRODUCT_LIMIT}
          </span>
        </div>
        </form>
          </main>
          </div>
          </div>

          {/* 상품명 추출 모달 */}
          {showTitleExtractModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="title-extract-modal-title"
              onClick={() => setShowTitleExtractModal(false)}
            >
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="title-extract-modal-title" className="mb-3 text-lg font-bold text-[var(--text-primary)]">
                  상품명 추출
                </h3>
                <p className="mb-2 text-xs text-[var(--text-muted)]">
                  원본 페이지에서 상품명/요약(상단 소개)을 복사해 붙여넣으세요.
                </p>
                <textarea
                  value={titleExtractPaste}
                  onChange={(e) => setTitleExtractPaste(e.target.value)}
                  placeholder="텍스트 붙여넣기..."
                  rows={5}
                  className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                />
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runTitleExtract}
                    className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
                  >
                    후보 추출
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTitleExtractModal(false);
                      setTitleExtractPaste("");
                      setTitleCandidates([]);
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    닫기
                  </button>
                </div>
                {titleCandidates.length > 0 ? (
                  <ul className="space-y-2">
                    {titleCandidates.map((c, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{c}</span>
                        <button
                          type="button"
                          onClick={() => void applyTitleCandidate(c, false)}
                          className="shrink-0 rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)]"
                        >
                          상품명에 적용
                        </button>
                        {form.title.trim() ? (
                          <button
                            type="button"
                            onClick={() => void applyTitleCandidate(c, true)}
                            className="shrink-0 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                          >
                            합치기
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}

          {/* 대표 이미지 추천 모달 */}
          {showCoverRecommendModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cover-recommend-modal-title"
              onClick={() => setShowCoverRecommendModal(false)}
            >
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="cover-recommend-modal-title" className="mb-3 text-lg font-bold text-[var(--text-primary)]">
                  대표 이미지 추천
                </h3>
                {coverCandidates.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">추천할 이미지가 없습니다. 상품 이미지 또는 일정 이미지를 먼저 등록하세요.</p>
                ) : (
                  <ul className="space-y-3">
                    {coverCandidates.map((c, i) => (
                      <li key={c.url + i} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                        <div className="h-16 w-24 shrink-0 overflow-hidden rounded bg-[var(--surface)]">
                          <img
                            src={normalizeProductImageUrl(c.url)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[var(--text-muted)]">{c.reason}</p>
                          <button
                            type="button"
                            onClick={() => setCoverAsPrimary(c.url)}
                            className="mt-1 rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                          >
                            대표로 지정
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setShowCoverRecommendModal(false)}
                  className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                >
                  닫기
                </button>
              </div>
            </div>
          )}

          {/* 우측: 미리보기 패널 — lg에서 항상, small에서는 탭이 카드/상세일 때만 */}
          <aside
            id="product-form-preview-panel"
            className={smallScreenTab !== "input" ? "block" : "hidden lg:block"}
            aria-label="실시간 미리보기"
            aria-hidden={smallScreenTab === "input"}
          >
            <div className="sticky top-4 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] ring-1 ring-[var(--border)] p-4">
              <h3 className="text-lg font-bold text-[var(--primary)]">실시간 미리보기</h3>

              {previewWarnings.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                  <p className="text-xs font-semibold text-amber-800">미리보기 품질 경고</p>
                  <ul className="space-y-1">
                    {previewWarnings.map((w) => (
                      <li key={w.id}>
                        <button
                          type="button"
                          onClick={() => handleWarningClick(w.sectionId)}
                          className="w-full text-left text-xs text-amber-800 underline-offset-2 hover:underline"
                        >
                          {w.message}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* previewProduct 구성 확인용 (실서비스 컴포넌트 연결 전) */}
              <details className="rounded-lg border border-[var(--border)] bg-slate-50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                  previewProduct 확인 (JSON)
                </summary>
                <pre className="max-h-48 overflow-auto p-3 text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(effectivePreviewProduct, null, 2)}
                </pre>
              </details>

              {/* 디바이스 토글 (Desktop / Mobile) */}
              <div className="flex gap-2" role="tablist" aria-label="미리보기 뷰">
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewDevice === "desktop"}
                  onClick={() => setPreviewDevice("desktop")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    previewDevice === "desktop"
                      ? "bg-[#1e3a8a] text-white"
                      : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                  }`}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewDevice === "mobile"}
                  onClick={() => setPreviewDevice("mobile")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    previewDevice === "mobile"
                      ? "bg-[#1e3a8a] text-white"
                      : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                  }`}
                >
                  Mobile
                </button>
              </div>

              {/* 상품 카드 미리보기 — lg에서는 항상, small에서는 탭이 카드일 때만 */}
              <section
                className={smallScreenTab === "detail" ? "hidden lg:block" : "block"}
                aria-labelledby="preview-card-heading"
              >
                <h4 id="preview-card-heading" className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                  상품 카드 미리보기
                </h4>
                <div
                  className={`${previewDevice === "mobile" ? "max-w-[360px]" : "max-w-[640px]"} mx-auto`}
                  data-preview-view={previewDevice}
                >
                  <ProductCardV2 {...previewCardProps} />
                </div>
              </section>

              {/* 상세 페이지 미리보기 — lg에서는 항상, small에서는 탭이 상세일 때만 */}
              <section
                className={smallScreenTab === "card" ? "hidden lg:block" : "block"}
                aria-labelledby="preview-detail-heading"
              >
                <h4 id="preview-detail-heading" className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                  상세 페이지 미리보기
                </h4>
                <label className="mb-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={showDetailSticky}
                    onChange={(e) => setShowDetailSticky(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--primary)]"
                  />
                  Sticky CTA 표시
                </label>
                <div
                  className={`rounded-xl border border-[#dbeafe] bg-[#f8fbff] ${previewDevice === "mobile" ? "max-w-[360px]" : ""}`}
                  data-preview-view={previewDevice}
                >
                  <ConsultModalProvider>
                    <ProductQuoteProvider>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                        <div className="min-w-0 flex-1 space-y-4 p-4">
                          <ProductDetailV2 {...previewDetailProps} />
                        </div>
                        {showDetailSticky && previewDevice !== "mobile" && (
                          <ProductDetailStickyV2Desktop
                            priceFormatted={previewDetailProps.priceFormatted}
                            productId="_preview"
                            productTitle={effectivePreviewProduct.title}
                            sourcePath="/admin/products"
                            kakaoHref="#"
                            status={previewDetailProps.statusTag}
                            trust={undefined}
                          />
                        )}
                      </div>
                      {showDetailSticky && (
                        <ProductDetailStickyV2Mobile
                          priceFormatted={previewDetailProps.priceFormatted}
                          productId="_preview"
                          productTitle={effectivePreviewProduct.title}
                          sourcePath="/admin/products"
                          kakaoHref="#"
                          status={previewDetailProps.statusTag}
                        />
                      )}
                    </ProductQuoteProvider>
                  </ConsultModalProvider>
                </div>
              </section>
            </div>
          </aside>
        </div>
        </>
      ) : null}

      {isListView && !editingId ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-[var(--primary)]">상품 목록</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={showFeaturedOnly}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setShowFeaturedOnly(next);
                    setPage(1);
                    loadProducts({ page: 1, featuredOnlyOverride: next });
                  }}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                추천상품만 보기
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                }}
                placeholder="상품 검색"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            </div>
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              <p>
                선택된 상품 <span className="font-semibold">{selectedIds.length}</span>개
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkDeleteSelected}
                  className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--danger)] hover:opacity-90"
                >
                  선택 삭제
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                >
                  선택 해제
                </button>
              </div>
            </div>
          ) : null}
        {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}
        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">상품 목록을 불러오는 중입니다...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] border-collapse text-sm">
              <thead className="bg-[var(--primary-soft)] text-[var(--primary)]">
                <tr>
                  <th className="w-[42px] px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      onChange={toggleSelectAllForPage}
                      checked={
                        pagedProducts.length > 0 &&
                        pagedProducts.every((product) => selectedIds.includes(product.id))
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">원본주소</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSortChange("title")}
                      className="inline-flex items-center gap-1"
                    >
                      <span>상품명</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {sortField === "title" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSortChange("category")}
                      className="inline-flex items-center gap-1"
                    >
                      <span>카테고리</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {sortField === "category" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">테마/배지</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSortChange("price")}
                      className="inline-flex items-center gap-1"
                    >
                      <span>가격</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {sortField === "price" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                  <th className="w-[170px] px-4 py-3 text-left font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSortChange("sort_order")}
                      className="inline-flex items-center gap-1"
                    >
                      <span>노출순서</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {sortField === "sort_order" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                  <th className="w-[110px] px-4 py-3 text-left font-semibold whitespace-nowrap">활성화</th>
                  <th className="w-[92px] px-4 py-3 text-center font-semibold whitespace-nowrap">메인추천</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">작업</th>
                </tr>
              </thead>
              <tbody>
                {pagedProducts.length === 0 ? (
                  <tr className="border-t border-[var(--divider)]">
                    <td colSpan={10} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]">
                          📦
                        </div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">등록된 상품이 없습니다.</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          상단의 &quot;상품 등록&quot; 탭에서 첫 번째 상품을 추가해 보세요.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedProducts.map((product) => (
                    <tr key={product.id} className="group border-t border-[var(--divider)] hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--primary)]"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => toggleSelectOne(product.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {product.product_source_url ? (
                          <a
                            href={product.product_source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
                          >
                            원본 보기
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="max-w-[270px] px-4 py-3 font-medium text-[var(--primary)]">
                        {product.title}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">{product.category}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{product.theme ?? "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {typeof product.price === "number"
                          ? `${new Intl.NumberFormat("ko-KR").format(product.price)}원`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex min-w-8 justify-center rounded bg-[var(--surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--text-primary)] ring-1 ring-[var(--border)]">
                            {typeof product.sort_order === "number" ? product.sort_order : "-"}
                          </span>
                          <button
                            type="button"
                            disabled={pendingMoveId === product.id}
                            onClick={() => moveSortOrder(product, "up")}
                            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                            title="위로 이동"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={pendingMoveId === product.id}
                            onClick={() => moveSortOrder(product, "down")}
                            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                            title="아래로 이동"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {product.is_active === false ? (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                            비노출
                          </span>
                        ) : (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--success-bg)] px-2.5 py-1 text-xs text-[var(--success)]">
                            노출
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {product.is_featured_home ? (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--primary-soft)] px-2 py-1 text-xs text-[var(--primary)]">
                            추천
                          </span>
                        ) : (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-muted)]">
                            일반
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          <button
                            type="button"
                            disabled={pendingToggleId === product.id}
                            onClick={() => quickToggleActive(product)}
                            className={`rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                              product.is_active === false
                                ? "border border-[var(--success)]/30 bg-[var(--success-bg)] text-[var(--success)] hover:opacity-90"
                                : "border border-[var(--danger)]/30 bg-[var(--danger-bg)] text-[var(--danger)] hover:opacity-90"
                            }`}
                          >
                            {product.is_active === false ? "활성화" : "비활성화"}
                          </button>
                          <button
                            type="button"
                            disabled={pendingFeaturedToggleId === product.id}
                            onClick={() => quickToggleFeaturedHome(product)}
                            className={`rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                              product.is_featured_home
                                ? "border border-[var(--warning)]/30 bg-[var(--warning-bg)] text-[var(--warning)] hover:opacity-90"
                                : "border border-[var(--primary)]/30 bg-[var(--primary-soft)] text-[var(--primary)] hover:opacity-90"
                            }`}
                          >
                            {product.is_featured_home ? "추천해제" : "추천등록"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(product.id);
                              setForm(mapProductToForm(product));
                              setActiveSchedulePreviewIndex(0);
                              setShowRawScheduleEditor(false);
                              setErrorMessage("");
                            }}
                            className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-muted)]"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <p>
            총 {totalCount}건 중 {totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1}-{Math.min(
              safePage * pageSize,
              totalCount,
            )}
            건 표시
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => movePage(safePage - 1)}
              disabled={safePage <= 1}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              이전
            </button>
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => movePage(safePage + 1)}
              disabled={safePage >= totalPages}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      </div>
      ) : null}

      <ImageImportGuideModal
        open={showImageImportGuideModal}
        onClose={() => setShowImageImportGuideModal(false)}
      />

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
            toast.type === "success" ? "bg-[var(--success)]" : "bg-[var(--danger)]"
            }`}
          >
            {toast.text}
          </div>
        </div>
      ) : null}
    </div>
  );
}
