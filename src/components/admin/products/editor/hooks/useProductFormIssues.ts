import { useMemo } from "react";
import { SECTIONS } from "@/components/admin/products/editor/adminProductForm.validation";
import type { SectionId, SectionIssue, FormIssue } from "@/components/admin/products/editor/adminProductForm.types";
import type { ProductFormState } from "@/types/adminProductForm";

export function useProductFormIssues(form: ProductFormState) {
  const issuesBySection = useMemo(() => {
    const out: Record<SectionId, SectionIssue[]> = {} as Record<SectionId, SectionIssue[]>;
    for (const section of SECTIONS) {
      out[section.id] = section.getIssues(form);
    }
    return out;
  }, [form]);

  const allIssues = useMemo<FormIssue[]>(() => {
    return SECTIONS.flatMap((s) => issuesBySection[s.id] ?? []);
  }, [issuesBySection]);

  const requiredIssues = useMemo(() => {
    return allIssues.filter((i) => i.severity === "required");
  }, [allIssues]);

  const issueCountsBySection = useMemo(() => {
    const out: Record<SectionId, { required: number; recommended: number }> = {} as Record<
      SectionId,
      { required: number; recommended: number }
    >;
    for (const s of SECTIONS) {
      const issues = issuesBySection[s.id] ?? [];
      out[s.id] = {
        required: issues.filter((i) => i.severity === "required").length,
        recommended: issues.filter((i) => i.severity === "recommended").length,
      };
    }
    return out;
  }, [issuesBySection]);

  const completedSectionCount = useMemo(() => {
    return SECTIONS.filter((s) => issueCountsBySection[s.id].required === 0).length;
  }, [issueCountsBySection]);

  return {
    issuesBySection,
    allIssues,
    requiredIssues,
    issueCountsBySection,
    completedSectionCount,
  };
}
