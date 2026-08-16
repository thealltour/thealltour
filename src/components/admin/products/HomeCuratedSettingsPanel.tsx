"use client";

/** 폼에서 편집하는 설정 필드만 (상위에서 controlled로 관리) */
export type HomeCuratedSettingsFormState = {
  section_label: string;
  section_title: string;
  section_description: string;
  catalog_button_label: string;
  catalog_button_href: string;
  is_active: boolean;
};

export type HomeCuratedSettingsPanelProps = {
  settings: HomeCuratedSettingsFormState;
  isSaving: boolean;
  onChangeField: (name: keyof HomeCuratedSettingsFormState, value: string | boolean) => void;
  onSave: () => void;
};

export default function HomeCuratedSettingsPanel({
  settings,
  isSaving,
  onChangeField,
  onSave,
}: HomeCuratedSettingsPanelProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="mb-4 text-sm font-semibold text-[var(--text-primary)]">홈 추천 상단 설정</p>
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-muted)]">섹션 라벨</span>
          <input
            type="text"
            value={settings.section_label}
            onChange={(e) => onChangeField("section_label", e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            placeholder="THEALL CURATED PICKS"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-muted)]">섹션 제목</span>
          <input
            type="text"
            value={settings.section_title}
            onChange={(e) => onChangeField("section_title", e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            placeholder="이번 달 선별 추천 여행"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-[var(--text-muted)]">섹션 설명</span>
          <input
            type="text"
            value={settings.section_description}
            onChange={(e) => onChangeField("section_description", e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            placeholder="설명 문구"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-muted)]">카탈로그 버튼 문구</span>
          <input
            type="text"
            value={settings.catalog_button_label}
            onChange={(e) => onChangeField("catalog_button_label", e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            placeholder="전체 상품 카탈로그 보기"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-muted)]">카탈로그 버튼 링크</span>
          <input
            type="text"
            value={settings.catalog_button_href}
            onChange={(e) => onChangeField("catalog_button_href", e.target.value || "/products")}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            placeholder="/products"
          />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={settings.is_active}
            onChange={(e) => onChangeField("is_active", e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <span className="text-sm text-[var(--text-primary)]">추천 섹션 노출</span>
        </label>
        {!settings.is_active && (
          <p className="sm:col-span-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
            메인 홈에 추천 섹션이 표시되지 않습니다. 표시하려면 위 체크박스를 켜고 아래 [설정 저장]을 누르세요.
          </p>
        )}
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? "저장 중..." : "설정 저장"}
        </button>
      </div>
    </div>
  );
}
