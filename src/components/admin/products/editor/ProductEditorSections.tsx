"use client";

import { ChevronDown, AlertCircle } from "lucide-react";
import { ProductFormSectionIssuesPanel } from "@/components/admin/ProductFormSectionIssuesPanel";
import { SECTIONS } from "@/components/admin/products/editor/adminProductForm.validation";
import type { SectionId, SectionIssue } from "@/components/admin/products/editor/adminProductForm.types";
import { BasicInfoSection, type BasicInfoSectionProps } from "./sections/BasicInfoSection";
import { ScheduleSection, type ScheduleSectionProps } from "./sections/ScheduleSection";
import {
  RemainingAccordionSections,
  type RemainingAccordionSectionsProps,
} from "./sections/RemainingAccordionSections";

/** basic / schedule은 전용 컴포넌트, 나머지는 RemainingAccordionSections에서 분기 */
export const SECTION_COMPONENTS = {
  basic: BasicInfoSection,
  schedule: ScheduleSection,
} as const;

export type ProductEditorSectionsProps = {
  sectionIssuesBySection: Record<SectionId, SectionIssue[]>;
  openSections: Record<string, boolean>;
  toggleSection: (id: SectionId) => void;
  openSectionAndScrollTo: (sectionId: SectionId, anchorId?: string) => void;
  basicInfoProps: BasicInfoSectionProps;
  scheduleProps: ScheduleSectionProps;
  remainingAccordionProps: Omit<RemainingAccordionSectionsProps, "sectionId">;
};

export function ProductEditorSections({
  sectionIssuesBySection,
  openSections,
  toggleSection,
  openSectionAndScrollTo,
  basicInfoProps,
  scheduleProps,
  remainingAccordionProps,
}: ProductEditorSectionsProps) {
  return (
    <>
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
              onClick={() => toggleSection(id as SectionId)}
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
                  className={`h-5 w-5 shrink-0 transition ${openSections[id] ? "rotate-180" : ""}`}
                />
              </span>
            </button>
            <div
              className={openSections[id] ? "block" : "hidden"}
              aria-hidden={!openSections[id]}
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
                {id === "basic" ? (
                  <BasicInfoSection {...basicInfoProps} />
                ) : id === "schedule" ? (
                  <ScheduleSection {...scheduleProps} />
                ) : (
                  <RemainingAccordionSections
                    sectionId={id as RemainingAccordionSectionsProps["sectionId"]}
                    {...remainingAccordionProps}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
