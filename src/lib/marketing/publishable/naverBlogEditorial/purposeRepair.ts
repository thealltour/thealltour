/**
 * Naver Blog Structure — section.purpose enum check + repair prompt helpers.
 *
 * Invalid purposes (e.g. development / conclusion / reframe) trigger a bounded
 * Structure Planner repair pass. No deterministic alias map — the planner must
 * choose an allowed purpose from section intent.
 */

import {
  NAVER_BLOG_SECTION_PURPOSES,
  type NaverBlogSectionPurpose,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";

/** Bounded purpose-only repair passes after a parseable structure JSON exists. */
export const NAVER_BLOG_STRUCTURE_PURPOSE_REPAIR_MAX = 2 as const;

export const NAVER_BLOG_SECTION_PURPOSE_ENUM_LINE =
  NAVER_BLOG_SECTION_PURPOSES.join(" | ");

export type InvalidSectionPurpose = {
  sectionId: string;
  purpose: unknown;
  heading?: string;
};

export function isAllowedNaverBlogSectionPurpose(
  value: unknown,
): value is NaverBlogSectionPurpose {
  return (
    typeof value === "string" &&
    (NAVER_BLOG_SECTION_PURPOSES as readonly string[]).includes(value)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Scan raw Structure Planner JSON for section.purpose values outside the enum. */
export function listInvalidSectionPurposes(llm: unknown): InvalidSectionPurpose[] {
  const root = asRecord(llm);
  if (!root) return [{ sectionId: "(root)", purpose: llm }];
  const sectionsRaw = root.sectionPlan ?? root.section_plan;
  if (!Array.isArray(sectionsRaw)) {
    return [{ sectionId: "(sectionPlan)", purpose: sectionsRaw }];
  }
  const invalid: InvalidSectionPurpose[] = [];
  for (let index = 0; index < sectionsRaw.length; index++) {
    const row = asRecord(sectionsRaw[index]);
    const sectionId =
      (row && typeof (row.sectionId ?? row.section_id) === "string"
        ? String(row.sectionId ?? row.section_id).trim()
        : "") || `sec_${String(index + 1).padStart(2, "0")}`;
    const purpose = row?.purpose;
    if (!isAllowedNaverBlogSectionPurpose(purpose)) {
      invalid.push({
        sectionId,
        purpose,
        heading: typeof row?.heading === "string" ? row.heading : undefined,
      });
    }
  }
  return invalid;
}

export function structureLlmHasInvalidPurposes(llm: unknown): boolean {
  return listInvalidSectionPurposes(llm).length > 0;
}

/**
 * Prompt block for purpose-only repair. Intentionally has NO alias table
 * (do not hardcode development/conclusion/reframe to fixed enum values).
 */
export function buildNaverBlogStructurePurposeRepairHint(
  invalid: InvalidSectionPurpose[],
): string {
  const listed = invalid
    .map((row) => {
      const heading = row.heading ? ` heading=${JSON.stringify(row.heading)}` : "";
      return `- ${row.sectionId}: purpose=${JSON.stringify(row.purpose)}${heading}`;
    })
    .join("\n");
  return [
    "PURPOSE REPAIR (bounded): One or more section.purpose values are outside the allowed enum.",
    `Allowed purpose enum ONLY: ${NAVER_BLOG_SECTION_PURPOSE_ENUM_LINE}`,
    "Free-form purpose labels are forbidden (e.g. development, conclusion, reframe, body, payoff).",
    "For each invalid section, choose the allowed purpose that best matches THAT section's actual role",
    "(heading + narrativeBeatRefs + position). Examples of guidance — not a mapping table:",
    "- Prefer closing (not conclusion) for wrap-up sections.",
    "- Prefer context / detail / evidence / contrast instead of generic development — pick by content.",
    "Constraints:",
    "- Keep section count, order, and sectionId unchanged.",
    "- Keep titles/headings when possible; do not redesign the article structure.",
    "- Do not add/remove sections; do not invent facts.",
    "- Return the FULL corrected structure JSON (same schema as SOUL).",
    "Invalid sections:",
    listed,
  ].join("\n");
}
