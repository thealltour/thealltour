import { createHash } from "node:crypto";

import type {
  NaverBlogCopy,
  NaverBlogStructurePlan,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function buildNaverBlogStructureContentFingerprint(
  plan: Pick<
    NaverBlogStructurePlan,
    | "assetId"
    | "assetVersion"
    | "selectedTitle"
    | "sectionPlan"
    | "openingIntent"
    | "conclusionIntent"
    | "ctaIntent"
    | "faqPlan"
  >,
): string {
  return sha256Hex(
    stableStringify({
      kind: "naver-blog-structure-content-v1",
      assetId: plan.assetId,
      assetVersion: plan.assetVersion,
      selectedTitle: plan.selectedTitle,
      sectionPlan: plan.sectionPlan,
      openingIntent: plan.openingIntent,
      conclusionIntent: plan.conclusionIntent,
      ctaIntent: plan.ctaIntent,
      faqPlan: plan.faqPlan,
    }),
  );
}

export function buildNaverBlogCopyContentFingerprint(
  copy: Pick<NaverBlogCopy, "assetId" | "assetVersion" | "title" | "bodyMarkdown" | "sectionOutputs">,
): string {
  return sha256Hex(
    stableStringify({
      kind: "naver-blog-copy-content-v1",
      assetId: copy.assetId,
      assetVersion: copy.assetVersion,
      title: copy.title,
      bodyMarkdown: copy.bodyMarkdown,
      sectionOutputs: copy.sectionOutputs,
    }),
  );
}
