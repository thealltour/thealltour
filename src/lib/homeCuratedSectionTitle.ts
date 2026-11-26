import type {
  HomeCuratedSettings,
  HomeCuratedSectionWithProducts,
} from "@/types/homeCurated";

const DEFAULT_HOME_CURATED_SECTION_TITLE = "추천 여행";

/** 레거시 브랜드 라벨 → 홈 표시용 제목 */
function normalizeHomeCuratedDisplayTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^theall\s*picks$/i.test(trimmed)) return DEFAULT_HOME_CURATED_SECTION_TITLE;
  return trimmed;
}

/**
 * 홈 Curated 헤더 제목 — settings.section_title 비어 있을 때 단일 섹션 title 등으로 보강.
 * Admin: home_curated_settings.section_title (홈 추천 상단 설정 > 섹션 제목)
 * `THEALL PICKS`는 UI에서 `추천 여행`으로 표시.
 */
export function resolveHomeCuratedSectionTitle(
  settings: HomeCuratedSettings,
  sections: HomeCuratedSectionWithProducts[],
): string {
  const fromSettings = normalizeHomeCuratedDisplayTitle(settings.section_title ?? "");
  if (fromSettings) return fromSettings;

  if (sections.length === 1) {
    const onlyTitle = normalizeHomeCuratedDisplayTitle(sections[0]?.title ?? "");
    if (onlyTitle) return onlyTitle;
  }

  const fromLabel = normalizeHomeCuratedDisplayTitle(settings.section_label ?? "");
  if (fromLabel) return fromLabel;

  return DEFAULT_HOME_CURATED_SECTION_TITLE;
}
