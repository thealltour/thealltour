import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import {
  NAVER_BLOG_COPY_CONTRACT,
  NAVER_BLOG_COPY_WRITER_HERMES_PROFILE,
  NAVER_BLOG_SECTION_PURPOSES,
  NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
  NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE,
  NAVER_BLOG_TARGET_DEPTHS,
  type NaverBlogCopy,
  type NaverBlogSectionPurpose,
  type NaverBlogStructurePlan,
  type NaverBlogTargetDepth,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { stripEvidenceIdsFromText } from "@/lib/marketing/publishable/validate";

export class NaverBlogEditorialMaterializeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "NaverBlogEditorialMaterializeError";
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new NaverBlogEditorialMaterializeError("missing_field", `${field} required`);
  }
  return value.trim();
}

function isPurpose(value: unknown): value is NaverBlogSectionPurpose {
  return typeof value === "string" && (NAVER_BLOG_SECTION_PURPOSES as readonly string[]).includes(value);
}

function isDepth(value: unknown): value is NaverBlogTargetDepth {
  return typeof value === "string" && (NAVER_BLOG_TARGET_DEPTHS as readonly string[]).includes(value);
}

/** Interpretive / geographic inventions that must not appear as blog structure/copy facts. */
export const NAVER_BLOG_UNSAFE_GENERALIZATION_RE =
  /남부\s*프레임|남부\s*베트남(?!\s*관광)|관광\s*광고가\s*아니라|휴양\s*광고가\s*아니라|현지인의\s*진짜\s*삶|수백\s*년\s*이어온|꼭\s*가봐야/i;

export const NAVER_BLOG_FORCED_CTA_RE =
  /지금\s*예약|저장해\s*두|문의하세|비교\s*후\s*선택|클릭해\s*보|팔로우해/i;

export function hasNaverBlogUnsafeGeneralization(text: string): boolean {
  return NAVER_BLOG_UNSAFE_GENERALIZATION_RE.test(text);
}

export function hasNaverBlogForcedCta(text: string): boolean {
  return NAVER_BLOG_FORCED_CTA_RE.test(text);
}

export function materializeNaverBlogStructurePlan(input: {
  assetId: string;
  assetVersion: number;
  sourceNarrativeFingerprint: string;
  narrative: EditorialNarrativePlan;
  modelProfile?: string;
  generatedAt?: string;
  llm: unknown;
}): NaverBlogStructurePlan {
  const root = asRecord(input.llm);
  if (!root) {
    throw new NaverBlogEditorialMaterializeError("invalid_llm", "Structure LLM output must be an object");
  }

  // Structure must not contain long article body.
  if (typeof root.bodyMarkdown === "string" && root.bodyMarkdown.trim().length > 400) {
    throw new NaverBlogEditorialMaterializeError(
      "structure_has_body",
      "Structure Planner must not emit article bodyMarkdown",
    );
  }
  if (typeof root.body === "string" && root.body.trim().length > 400) {
    throw new NaverBlogEditorialMaterializeError(
      "structure_has_body",
      "Structure Planner must not emit article body",
    );
  }

  const selectedTitle = stripEvidenceIdsFromText(
    requireNonEmptyString(root.selectedTitle ?? root.selected_title, "selectedTitle"),
  );
  const titleStrategy = stripEvidenceIdsFromText(
    requireNonEmptyString(root.titleStrategy ?? root.title_strategy ?? "editorial", "titleStrategy"),
  );
  const primaryTopic = stripEvidenceIdsFromText(
    requireNonEmptyString(root.primaryTopic ?? root.primary_topic ?? selectedTitle, "primaryTopic"),
  );
  const openingIntent = stripEvidenceIdsFromText(
    requireNonEmptyString(root.openingIntent ?? root.opening_intent, "openingIntent"),
  );
  const conclusionIntent = stripEvidenceIdsFromText(
    requireNonEmptyString(root.conclusionIntent ?? root.conclusion_intent, "conclusionIntent"),
  );
  const evidenceCoverage = stripEvidenceIdsFromText(
    requireNonEmptyString(root.evidenceCoverage ?? root.evidence_coverage ?? "canonical", "evidenceCoverage"),
  );

  const titleCandidatesRaw = Array.isArray(root.titleCandidates)
    ? root.titleCandidates
    : Array.isArray(root.title_candidates)
      ? root.title_candidates
      : [selectedTitle];
  const titleCandidates = titleCandidatesRaw
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => stripEvidenceIdsFromText(v))
    .slice(0, 5);
  if (titleCandidates.length < 1) titleCandidates.push(selectedTitle);
  if (!titleCandidates.includes(selectedTitle)) titleCandidates.unshift(selectedTitle);

  const validBeatIds = new Set(input.narrative.beats.map((b) => b.beatId));
  const sectionsRaw = root.sectionPlan ?? root.section_plan;
  if (!Array.isArray(sectionsRaw) || sectionsRaw.length < 3) {
    throw new NaverBlogEditorialMaterializeError(
      "sections_required",
      "sectionPlan requires at least 3 sections",
    );
  }

  const seenIds = new Set<string>();
  const sectionPlan = sectionsRaw.map((raw, index) => {
    const row = asRecord(raw);
    if (!row) {
      throw new NaverBlogEditorialMaterializeError("invalid_section", `section ${index} invalid`);
    }
    const sectionId = requireNonEmptyString(
      row.sectionId ?? row.section_id ?? `sec_${String(index + 1).padStart(2, "0")}`,
      "sectionId",
    );
    if (seenIds.has(sectionId)) {
      throw new NaverBlogEditorialMaterializeError("duplicate_section", `Duplicate sectionId ${sectionId}`);
    }
    seenIds.add(sectionId);
    const purposeRaw = row.purpose;
    if (!isPurpose(purposeRaw)) {
      throw new NaverBlogEditorialMaterializeError("invalid_purpose", `Invalid purpose on ${sectionId}`);
    }
    const heading = stripEvidenceIdsFromText(requireNonEmptyString(row.heading, "heading"));
    const depthRaw = row.targetDepth ?? row.target_depth ?? "standard";
    if (!isDepth(depthRaw)) {
      throw new NaverBlogEditorialMaterializeError("invalid_depth", `Invalid targetDepth on ${sectionId}`);
    }
    const beatRefs = Array.isArray(row.narrativeBeatRefs ?? row.narrative_beat_refs)
      ? ((row.narrativeBeatRefs ?? row.narrative_beat_refs) as unknown[])
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim())
      : [];
    for (const beatId of beatRefs) {
      if (!validBeatIds.has(beatId)) {
        throw new NaverBlogEditorialMaterializeError("unknown_beat", `Unknown beat ${beatId}`);
      }
    }
    const evidenceRefs = Array.isArray(row.evidenceRefs ?? row.evidence_refs)
      ? ((row.evidenceRefs ?? row.evidence_refs) as unknown[])
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim())
      : [];
    return {
      sectionId,
      purpose: purposeRaw,
      heading,
      narrativeBeatRefs: beatRefs,
      evidenceRefs,
      targetDepth: depthRaw,
    };
  });

  const faqPlanRaw = Array.isArray(root.faqPlan) ? root.faqPlan : Array.isArray(root.faq_plan) ? root.faq_plan : [];
  const faqPlan = faqPlanRaw
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const question = typeof row.question === "string" ? stripEvidenceIdsFromText(row.question) : "";
      if (!question) return null;
      const answerability =
        row.answerability === "unsupported" || row.answerability === "supported"
          ? row.answerability
          : "supported";
      if (answerability === "unsupported") return null;
      return { question, answerability: "supported" as const };
    })
    .filter(Boolean) as Array<{ question: string; answerability: "supported" }>;

  const ctaIntentRaw = root.ctaIntent ?? root.cta_intent;
  const ctaIntent =
    ctaIntentRaw == null || ctaIntentRaw === ""
      ? null
      : stripEvidenceIdsFromText(String(ctaIntentRaw));

  const searchIntentRaw = root.searchIntent ?? root.search_intent;
  const searchIntent =
    searchIntentRaw == null || searchIntentRaw === ""
      ? null
      : stripEvidenceIdsFromText(String(searchIntentRaw));

  const blob = [
    selectedTitle,
    titleStrategy,
    openingIntent,
    conclusionIntent,
    ctaIntent ?? "",
    ...sectionPlan.map((s) => s.heading),
  ].join("\n");
  if (hasNaverBlogUnsafeGeneralization(blob)) {
    throw new NaverBlogEditorialMaterializeError(
      "unsafe_generalization",
      "Structure plan contains unsupported geographic/cultural generalization",
    );
  }
  if (ctaIntent && hasNaverBlogForcedCta(ctaIntent)) {
    throw new NaverBlogEditorialMaterializeError("forced_cta", "Structure ctaIntent is forced sales CTA");
  }

  return {
    contract: NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    titleStrategy,
    selectedTitle,
    titleCandidates: titleCandidates.slice(0, 5),
    sectionPlan,
    openingIntent,
    conclusionIntent,
    ctaIntent,
    faqPlan,
    searchIntent,
    primaryTopic,
    evidenceCoverage,
    sourceNarrativeFingerprint: input.sourceNarrativeFingerprint,
    provenance: {
      sourceAssetId: input.assetId,
      sourceVersion: input.assetVersion,
      modelProfile: input.modelProfile ?? NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      sourceUpstreamFingerprint: input.sourceNarrativeFingerprint,
    },
  };
}

export function materializeNaverBlogCopy(input: {
  assetId: string;
  assetVersion: number;
  sourceStructureFingerprint: string;
  structure: NaverBlogStructurePlan;
  modelProfile?: string;
  generatedAt?: string;
  llm: unknown;
}): NaverBlogCopy {
  const root = asRecord(input.llm);
  if (!root) {
    throw new NaverBlogEditorialMaterializeError("invalid_llm", "Copy LLM output must be an object");
  }

  const title = stripEvidenceIdsFromText(
    requireNonEmptyString(root.title ?? root.selectedTitle ?? input.structure.selectedTitle, "title"),
  );
  let bodyMarkdown = stripEvidenceIdsFromText(
    requireNonEmptyString(root.bodyMarkdown ?? root.body, "bodyMarkdown"),
  );
  if (!bodyMarkdown.startsWith("#")) {
    bodyMarkdown = `# ${title}\n\n${bodyMarkdown}`;
  }

  const expectedIds = input.structure.sectionPlan.map((s) => s.sectionId);
  const outputsRaw = Array.isArray(root.sectionOutputs)
    ? root.sectionOutputs
    : Array.isArray(root.section_outputs)
      ? root.section_outputs
      : [];
  if (!Array.isArray(outputsRaw) || outputsRaw.length !== expectedIds.length) {
    throw new NaverBlogEditorialMaterializeError(
      "section_mismatch",
      `sectionOutputs must match structure section count (${expectedIds.length})`,
    );
  }

  const sectionOutputs = outputsRaw.map((raw, index) => {
    const row = asRecord(raw);
    if (!row) {
      throw new NaverBlogEditorialMaterializeError("invalid_section_output", `output ${index} invalid`);
    }
    const sectionId = requireNonEmptyString(row.sectionId ?? row.section_id, "sectionId");
    if (sectionId !== expectedIds[index]) {
      throw new NaverBlogEditorialMaterializeError(
        "section_order",
        `sectionOutputs order must follow structure (expected ${expectedIds[index]}, got ${sectionId})`,
      );
    }
    const planned = input.structure.sectionPlan[index]!;
    const heading = stripEvidenceIdsFromText(
      typeof row.heading === "string" && row.heading.trim()
        ? row.heading
        : planned.heading,
    );
    const body = stripEvidenceIdsFromText(requireNonEmptyString(row.bodyMarkdown ?? row.body, "bodyMarkdown"));
    return { sectionId, heading, bodyMarkdown: body };
  });

  const faqRaw = Array.isArray(root.faq) ? root.faq : [];
  const faq = faqRaw
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const question = typeof row.question === "string" ? stripEvidenceIdsFromText(row.question) : "";
      const answer = typeof row.answer === "string" ? stripEvidenceIdsFromText(row.answer) : "";
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter(Boolean) as Array<{ question: string; answer: string }>;

  // Only allow FAQ if structure planned supported questions (or empty).
  if (faq.length > 0 && input.structure.faqPlan.length === 0) {
    throw new NaverBlogEditorialMaterializeError(
      "faq_not_planned",
      "Copy must not invent FAQ when structure faqPlan is empty",
    );
  }

  const ctaRaw = root.cta;
  const cta =
    ctaRaw == null || ctaRaw === ""
      ? input.structure.ctaIntent
      : stripEvidenceIdsFromText(String(ctaRaw));

  const evidenceRefs = Array.isArray(root.evidenceRefs)
    ? root.evidenceRefs.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];

  const safetyBlob = [title, bodyMarkdown, cta ?? "", ...faq.map((f) => `${f.question}${f.answer}`)].join(
    "\n",
  );
  if (hasNaverBlogUnsafeGeneralization(safetyBlob)) {
    throw new NaverBlogEditorialMaterializeError(
      "unsafe_generalization",
      "Copy contains unsupported geographic/cultural generalization",
    );
  }
  if (cta && hasNaverBlogForcedCta(cta)) {
    throw new NaverBlogEditorialMaterializeError("forced_cta", "Copy CTA is forced sales phrasing");
  }
  if (hasNaverBlogForcedCta(bodyMarkdown)) {
    throw new NaverBlogEditorialMaterializeError("forced_cta", "Copy body contains forced CTA phrasing");
  }

  return {
    contract: NAVER_BLOG_COPY_CONTRACT,
    assetId: input.assetId,
    assetVersion: input.assetVersion,
    title,
    bodyMarkdown,
    sectionOutputs,
    faq,
    cta,
    evidenceRefs,
    sourceStructureFingerprint: input.sourceStructureFingerprint,
    provenance: {
      sourceAssetId: input.assetId,
      sourceVersion: input.assetVersion,
      modelProfile: input.modelProfile ?? NAVER_BLOG_COPY_WRITER_HERMES_PROFILE,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      sourceUpstreamFingerprint: input.sourceStructureFingerprint,
    },
  };
}
