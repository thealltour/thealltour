import type { Dispatch, SetStateAction } from "react";
import type { ProductFormState } from "@/types/adminProductForm";
import type { IncludedTemplateItem } from "@/components/admin/products/editor/adminProductTemplates";

export type TemplateInsertMode = "replace" | "append";

/** 스니펫 삽입 대상 문자열 필드 */
export type TemplateTextFieldKey =
  | "description"
  | "booking_notes"
  | "travel_notes"
  | "booking_conditions"
  | "refund_policy";

export function useTemplateInsert(setForm: Dispatch<SetStateAction<ProductFormState>>) {
  function insertText(field: TemplateTextFieldKey, value: string, mode: TemplateInsertMode) {
    setForm((prev) => {
      const current = prev[field] ?? "";
      return {
        ...prev,
        [field]:
          mode === "replace" ? value : current ? `${current}\n\n${value}` : value,
      };
    });
  }

  function insertIncludedTemplate(template: IncludedTemplateItem, mode: TemplateInsertMode) {
    setForm((prev) => ({
      ...prev,
      included_items:
        mode === "replace"
          ? template.included
          : [prev.included_items, template.included].filter(Boolean).join("\n\n"),
      excluded_items:
        mode === "replace"
          ? template.excluded
          : [prev.excluded_items, template.excluded].filter(Boolean).join("\n\n"),
      optional_tours:
        mode === "replace"
          ? template.optional
          : [prev.optional_tours, template.optional].filter(Boolean).join("\n\n"),
    }));
  }

  return {
    insertText,
    insertIncludedTemplate,
  };
}
