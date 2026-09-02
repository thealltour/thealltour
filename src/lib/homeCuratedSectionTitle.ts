import type {
  HomeCuratedSettings,
  HomeCuratedSectionWithProducts,
} from "@/types/homeCurated";

const DEFAULT_HOME_CURATED_SECTION_TITLE = "추천 여행";

/**
 * 홈 Curated 헤더 제목 — settings.section_title 비어 있을 때 단일 섹션 title 등으로 보강.
 * Admin: home_curated_settings.section_title (홈 추천 상단 설정 > 섹션 제목)
 */
export function resolveHomeCuratedSectionTitle(
  settings: HomeCuratedSettings,
  sections: HomeCuratedSectionWithProducts[],
): string {
  const fromSettings = settings.section_title?.trim();
  if (fromSettings) return fromSettings;

  if (sections.length === 1) {
    const onlyTitle = sections[0]?.title?.trim();
    if (onlyTitle) return onlyTitle;
  }

  const fromLabel = settings.section_label?.trim();
  if (fromLabel) return fromLabel;

  return DEFAULT_HOME_CURATED_SECTION_TITLE;
}
