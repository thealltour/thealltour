/**
 * Admin product form - 공통 타입/섹션 이슈 타입
 * ProductFormState 등은 @/types/adminProductForm 재사용
 */

import type { ProductFormState as AdminProductFormState } from "@/types/adminProductForm";

export type {
  ProductFormState,
  ProductFormDraft,
  TermsTemplateType,
} from "@/types/adminProductForm";

export type SectionId =
  | "basic"
  | "taxonomy"
  | "travel"
  | "schedule"
  | "ops"
  | "advanced";

/** sessionStorage 등 레거시 섹션 id → 신규 id */
export const LEGACY_SECTION_ID_MAP: Record<string, SectionId> = {
  price: "travel",
  description: "advanced",
  included: "travel",
  flight: "travel",
  terms: "ops",
};

export function normalizeSectionId(raw: string | null | undefined): SectionId | null {
  if (!raw) return null;
  if (
    raw === "basic" ||
    raw === "taxonomy" ||
    raw === "travel" ||
    raw === "schedule" ||
    raw === "ops" ||
    raw === "advanced"
  ) {
    return raw;
  }
  return LEGACY_SECTION_ID_MAP[raw] ?? null;
}

export type IssueSeverity = "required" | "recommended";

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
  getIssues: (form: AdminProductFormState) => SectionIssue[];
};

/** 저장 payload (serializer 출력) */
export type AdminProductSavePayload = Record<string, unknown>;
