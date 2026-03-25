import type { TermsTemplateType } from "@/types/adminProductForm";

export const TERMS_TEMPLATE_OPTIONS: ReadonlyArray<{
  value: TermsTemplateType;
  label: string;
}> = [
  { value: "overseas_brokerage", label: "해외중개" },
  { value: "domestic_brokerage", label: "국내중개" },
  { value: "overseas_direct", label: "해외직접" },
  { value: "domestic_direct", label: "국내직접" },
];
