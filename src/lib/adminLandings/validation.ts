import type { AdminLandingDetail, LandingPublishValidationIssue } from "@/types/adminLanding";

export type LandingPublishValidationResult =
  | { ok: true }
  | { ok: false; issues: LandingPublishValidationIssue[] };

/**
 * 수동 Publish 전 서버 기준 최소 품질 검증.
 * (자동 publish 없음 — 항상 이 검증을 통과한 경우에만 공개 상태로 전환)
 */
export function validateLandingForPublish(landing: AdminLandingDetail): LandingPublishValidationResult {
  const issues: LandingPublishValidationIssue[] = [];

  if (!landing.title?.trim()) {
    issues.push({ field: "title", message: "제목이 필요합니다." });
  }
  if (!landing.slug?.trim()) {
    issues.push({ field: "slug", message: "slug가 필요합니다." });
  }
  if (!String(landing.templateType ?? "").trim()) {
    issues.push({ field: "templateType", message: "템플릿 유형이 필요합니다." });
  }

  const sections = landing.sections ?? [];
  if (sections.length < 1) {
    issues.push({ field: "sections", message: "섹션이 최소 1개 이상 필요합니다." });
  }

  const enabledSections = sections.filter((s) => s.isEnabled);
  if (sections.length >= 1 && enabledSections.length < 1) {
    issues.push({ field: "sections", message: "활성화된 섹션이 최소 1개 필요합니다." });
  }

  const hero = sections.find((s) => String(s.sectionType) === "hero");
  if (!hero) {
    issues.push({ field: "sections.hero", message: "hero 섹션이 필요합니다." });
  } else if (!hero.isEnabled) {
    issues.push({ field: "sections.hero", message: "Hero 섹션이 비활성화되어 있습니다." });
  }

  const cta = sections.find((s) => String(s.sectionType) === "cta");
  if (!cta) {
    issues.push({ field: "sections.cta", message: "CTA 섹션이 필요합니다." });
  } else if (!cta.isEnabled) {
    issues.push({ field: "sections.cta", message: "CTA 섹션이 비활성화되어 있습니다." });
  }

  // LandingCtaSection → /quote: product_title(제목), source_path(공개 시 /recommended/[slug]) 필요 — title·slug 검증으로 충족

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true };
}
