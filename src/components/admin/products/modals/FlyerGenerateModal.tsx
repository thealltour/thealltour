"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import type { Product } from "@/types/product";
import {
  type FlyerDraftState,
  type FlyerSectionKey,
  type FlyerTemplateKey,
  FLYER_MAX_GALLERY_IMAGES,
  FLYER_SECTION_KEYS,
  FLYER_SECTION_LABELS,
  isFlyerTemplateVisualVariant,
} from "@/lib/flyers/flyer.types";
import type { FlyerGenerateModalProps } from "./flyerModal.types";
import {
  buildInitialFlyerDraft,
  linesToMultiline,
  multilineToLines,
  normalizePersistedFlyerDraft,
  setAllSections,
} from "./flyerModal.utils";
import { FlyerLongformPreview } from "./FlyerLongformPreview";
import { FlyerImageSelector } from "./FlyerImageSelector";
import { FLYER_TEMPLATES, flyerTemplateLabel } from "./flyerTemplates";
import { exportFlyerLongformDraftToPng } from "@/lib/flyers/exportFlyerLongformClone";
import { sanitizeFlyerPngFileName } from "@/lib/flyers/exportFlyerToPng";
import { buildPublicFlyerUrl } from "@/lib/flyers/publicFlyer";
import { buildOutfitChecklist } from "@/lib/flyers/weather/buildOutfitChecklist";

const SECTION_HINTS: Record<FlyerSectionKey, string> = {
  header: "제목·부제목이 상단에 표시됩니다.",
  departure: "출발지·일정·미팅·항공편 안내",
  baggage: "수하물·기내 반입 요약",
  preparation: "준비물 체크리스트",
  includedExcluded: "포함/불포함 (미리보기 각 최대 10항목)",
  notice: "유의사항·일정 변경 안내",
  weather: "날씨·현지 정보",
  gallery: "최대 5장, 순서는 화살표로 조정",
  footer: "브랜드·문의처",
};

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">{children}</label>
  );
}

/** 템플릿 선택 UI: 레거시 a4 키는 롱포맷 탭과 매핑 */
function templatePickerActiveKey(templateKey: FlyerTemplateKey): "longform-default" | "longform-visual" {
  return isFlyerTemplateVisualVariant(templateKey) ? "longform-visual" : "longform-default";
}

function formatSavedAt(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type FlyerModalShellProps = {
  product: Product;
  onClose: () => void;
  showToast?: FlyerGenerateModalProps["showToast"];
  persistedBootstrap: FlyerGenerateModalProps["persistedBootstrap"];
};

function SectionAccordion({
  sectionKey,
  open,
  onToggleOpen,
  checked,
  onToggleSection,
  children,
}: {
  sectionKey: FlyerSectionKey;
  open: boolean;
  onToggleOpen: () => void;
  checked: boolean;
  onToggleSection: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/60">
      <div className="flex items-start gap-2 p-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggleSection(e.target.checked)}
          className="mt-1 rounded border-[var(--border)]"
          aria-label={`${FLYER_SECTION_LABELS[sectionKey]} 표시`}
        />
        <button
          type="button"
          onClick={onToggleOpen}
          className="min-w-0 flex-1 rounded-lg text-left outline-none ring-[var(--primary)] focus-visible:ring-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{FLYER_SECTION_LABELS[sectionKey]}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">{SECTION_HINTS[sectionKey]}</p>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">{checked ? "표시 중" : "숨김"}</p>
            </div>
            <ChevronDown
              className={`mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </div>
        </button>
      </div>
      {open ? <div className="space-y-3 border-t border-[var(--border)] p-3 pt-3">{children}</div> : null}
    </div>
  );
}

function FlyerModalShell({ product, onClose, showToast, persistedBootstrap }: FlyerModalShellProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<FlyerDraftState>(
    persistedBootstrap?.draft
      ? normalizePersistedFlyerDraft(persistedBootstrap.draft, product)
      : buildInitialFlyerDraft(product),
  );

  const [draft, setDraft] = useState<FlyerDraftState>(() => draftRef.current);
  const [dirty, setDirty] = useState(() => !persistedBootstrap);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(() => persistedBootstrap?.id ?? null);
  const savedDraftIdRef = useRef<string | null>(persistedBootstrap?.id ?? null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => persistedBootstrap?.updatedAt ?? null);
  const [savedShareSlug, setSavedShareSlug] = useState<string | null>(() => {
    const s = persistedBootstrap?.shareSlug?.trim();
    return s ? s : null;
  });
  const savedShareSlugRef = useRef<string | null>(
    persistedBootstrap?.shareSlug?.trim() ? persistedBootstrap.shareSlug.trim() : null,
  );
  const [exportPending, setExportPending] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [outfitNewLine, setOutfitNewLine] = useState("");
  const [openSections, setOpenSections] = useState<Record<FlyerSectionKey, boolean>>(() => {
    const o = {} as Record<FlyerSectionKey, boolean>;
    for (const k of FLYER_SECTION_KEYS) o[k] = false;
    o.header = true;
    o.gallery = true;
    return o;
  });

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    savedDraftIdRef.current = savedDraftId;
  }, [savedDraftId]);

  useEffect(() => {
    savedShareSlugRef.current = savedShareSlug;
  }, [savedShareSlug]);

  const commitDraft = useCallback((next: FlyerDraftState) => {
    draftRef.current = next;
    setDraft(next);
    setDirty(true);
  }, []);

  const updateFields = useCallback(
    (patch: Partial<FlyerDraftState["fields"]>) => {
      commitDraft({ ...draftRef.current, fields: { ...draftRef.current.fields, ...patch } });
    },
    [commitDraft],
  );

  const toggleSection = useCallback(
    (key: FlyerSectionKey, checked: boolean) => {
      const cur = draftRef.current;
      commitDraft({ ...cur, sections: { ...cur.sections, [key]: checked } });
    },
    [commitDraft],
  );

  const selectAllSections = useCallback(
    (value: boolean) => {
      const cur = draftRef.current;
      commitDraft({ ...cur, sections: setAllSections(cur.sections, value) });
    },
    [commitDraft],
  );

  const setTemplateKey = useCallback(
    (templateKey: FlyerTemplateKey) => {
      commitDraft({ ...draftRef.current, templateKey });
    },
    [commitDraft],
  );

  const patchLayoutOptions = useCallback(
    (patch: Partial<FlyerDraftState["layoutOptions"]>) => {
      const cur = draftRef.current;
      commitDraft({
        ...cur,
        layoutOptions: { ...cur.layoutOptions, ...patch },
      });
    },
    [commitDraft],
  );

  const patchWeather = useCallback(
    (patch: Partial<FlyerDraftState["weather"]>) => {
      const cur = draftRef.current;
      commitDraft({
        ...cur,
        weather: { ...cur.weather, ...patch },
      });
    },
    [commitDraft],
  );

  const patchOutfitUser = useCallback(
    (nextOutfit: FlyerDraftState["outfit"]) => {
      const cur = draftRef.current;
      commitDraft({
        ...cur,
        outfit: { ...nextOutfit, isAutoGenerated: false },
      });
    },
    [commitDraft],
  );

  const fetchFlyerWeather = useCallback(
    async (forceRefresh?: boolean) => {
      const w = draftRef.current.weather;
      if (!w.city.trim()) {
        showToast?.("error", "도시명을 입력해 주세요.");
        return;
      }
      if (!w.startDate.trim() || !w.endDate.trim()) {
        showToast?.("error", "출발일과 도착일을 입력해 주세요.");
        return;
      }
      setWeatherLoading(true);
      try {
        const res = await fetch("/api/admin/flyers/weather", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: w.city.trim(),
            startDate: w.startDate.trim(),
            endDate: w.endDate.trim(),
            forceRefresh: forceRefresh === true,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          days?: FlyerDraftState["weather"]["days"];
          summaryText?: string;
          cached?: boolean;
          staleFallback?: boolean;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.message || "날씨 조회에 실패했습니다.");
        }
        const cur = draftRef.current;
        const summary = typeof data.summaryText === "string" ? data.summaryText : "";
        const days = Array.isArray(data.days) ? data.days : [];
        const outfitBuilt = buildOutfitChecklist(days);
        commitDraft({
          ...cur,
          weather: {
            ...cur.weather,
            city: w.city.trim(),
            startDate: w.startDate.trim(),
            endDate: w.endDate.trim(),
            days,
            summaryText: summary,
            isLoaded: true,
          },
          fields: {
            ...cur.fields,
            weatherSummary: summary || cur.fields.weatherSummary,
          },
          outfit: {
            items: outfitBuilt.items.map((text) => ({ text, included: true })),
            summaryText: outfitBuilt.summaryText,
            isAutoGenerated: true,
            tags: outfitBuilt.tags.length ? outfitBuilt.tags : undefined,
          },
        });
        if (data.staleFallback) {
          showToast?.(
            "success",
            "일시적 오류로 캐시된 날씨를 표시합니다. 잠시 후 「최신 날씨로 다시 조회」를 눌러 보세요.",
          );
        } else if (data.cached) {
          showToast?.("success", "저장된 날씨 캐시를 불러왔습니다. (최신값은 강제 갱신)");
        } else {
          showToast?.("success", "날씨를 불러왔습니다.");
        }
      } catch (e) {
        showToast?.("error", e instanceof Error ? e.message : "날씨 조회에 실패했습니다.");
      } finally {
        setWeatherLoading(false);
      }
    },
    [commitDraft, showToast],
  );

  const toggleSectionOpen = useCallback((k: FlyerSectionKey) => {
    setOpenSections((p) => ({ ...p, [k]: !p[k] }));
  }, []);

  const saveFlyer = useCallback(async (): Promise<string | null> => {
    setSaving(true);
    setSaveError(null);
    const d = draftRef.current;
    try {
      const body = {
        productId: product.id,
        templateKey: d.templateKey,
        layoutOptions: d.layoutOptions,
        sections: d.sections,
        fields: d.fields,
        weather: d.weather,
        outfit: d.outfit,
        imageUrls: d.selectedImageUrls.slice(0, FLYER_MAX_GALLERY_IMAGES),
      };

      const idForPatch = savedDraftIdRef.current;
      if (idForPatch) {
        const res = await fetch(`/api/admin/flyers/${idForPatch}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = (await res.json()) as {
          ok?: boolean;
          message?: string;
          draft?: { id: string; updatedAt: string; shareSlug?: string | null };
        };
        if (!res.ok || !j.ok || !j.draft?.id) {
          throw new Error(j.message || "저장에 실패했습니다.");
        }
        setLastSavedAt(j.draft.updatedAt);
        const sl = j.draft.shareSlug?.trim() || null;
        if (sl) {
          savedShareSlugRef.current = sl;
          setSavedShareSlug(sl);
        }
        setDirty(false);
        showToast?.("success", "유인물이 저장되었습니다.");
        return j.draft.id;
      }

      const res = await fetch("/api/admin/flyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        message?: string;
        draft?: { id: string; updatedAt: string; shareSlug?: string | null };
      };
      if (!res.ok || !j.ok || !j.draft?.id) {
        throw new Error(j.message || "저장에 실패했습니다.");
      }
      savedDraftIdRef.current = j.draft.id;
      setSavedDraftId(j.draft.id);
      setLastSavedAt(j.draft.updatedAt);
      const slNew = j.draft.shareSlug?.trim() || null;
      if (slNew) {
        savedShareSlugRef.current = slNew;
        setSavedShareSlug(slNew);
      }
      setDirty(false);
      showToast?.("success", "유인물이 저장되었습니다.");
      return j.draft.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "저장에 실패했습니다.";
      setSaveError(msg);
      showToast?.("error", msg);
      return null;
    } finally {
      setSaving(false);
    }
  }, [product.id, showToast]);

  const copyShareLink = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!savedDraftIdRef.current || dirty) {
      await saveFlyer();
    } else if (!savedShareSlugRef.current?.trim()) {
      await saveFlyer();
    }
    const sl = savedShareSlugRef.current?.trim();
    if (!sl) {
      showToast?.("error", "공유 링크(slug)가 없습니다. 저장을 다시 시도해 주세요.");
      return;
    }
    const url = buildPublicFlyerUrl(window.location.origin, sl);
    try {
      await navigator.clipboard.writeText(url);
      showToast?.("success", "공유 링크가 복사되었습니다.");
    } catch {
      showToast?.("error", "클립보드 복사에 실패했습니다.");
    }
  }, [dirty, saveFlyer, showToast]);

  const copyAdminLink = useCallback(async () => {
    if (typeof window === "undefined") return;
    let id = savedDraftId;
    if (!id || dirty) {
      id = await saveFlyer();
    }
    if (!id) return;
    const url = `${window.location.origin}/theall_manager_only/flyers/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast?.("success", "관리자 링크가 복사되었습니다.");
    } catch {
      showToast?.("error", "클립보드 복사에 실패했습니다.");
    }
  }, [dirty, saveFlyer, savedDraftId, showToast]);

  const handlePrint = useCallback(() => {
    document.body.classList.add("print-flyer-only");
    const cleanup = () => document.body.classList.remove("print-flyer-only");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 120_000);
    window.print();
  }, []);

  const handlePngExport = useCallback(async () => {
    const current = draftRef.current;
    if (!current) {
      showToast?.("error", "미리보기 데이터를 찾을 수 없습니다.");
      return;
    }
    setExportPending(true);
    try {
      const name = sanitizeFlyerPngFileName(current.fields.title || product.title || "product");
      await exportFlyerLongformDraftToPng(current, name, product);
      showToast?.("success", "PNG 파일을 저장했습니다.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PNG 저장에 실패했습니다.";
      showToast?.("error", msg);
    } finally {
      setExportPending(false);
    }
  }, [product, showToast]);

  const displayTitle = product.title?.trim() || "상품";

  const statusLine = saving
    ? "저장 중…"
    : saveError
      ? saveError
      : dirty
        ? "저장 안 됨"
        : savedDraftId
          ? `저장됨${lastSavedAt ? ` · ${formatSavedAt(lastSavedAt)}` : ""}`
          : "저장 안 됨";

  return (
    <div className="flex max-h-[min(90vh,920px)] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="flyer-modal-title" className="text-lg font-bold text-[var(--text-primary)]">
              유인물 생성
            </h2>
            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)] ring-1 ring-[var(--border)]">
              모바일 세로 롱포맷
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-[var(--border)] ${
                saving
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                  : dirty
                    ? "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                    : savedDraftId
                      ? "bg-[var(--success-bg)] text-[var(--success)]"
                      : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
              }`}
            >
              {saving ? "저장 중" : dirty ? "미저장" : savedDraftId ? "동기화됨" : "미저장"}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-[var(--text-secondary)]" title={displayTitle}>
            {displayTitle}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{statusLine}</p>
          {savedShareSlug ? (
            <p className="mt-1 break-all font-mono text-[10px] text-[var(--text-secondary)]">
              공유:{" "}
              {typeof window !== "undefined"
                ? buildPublicFlyerUrl(window.location.origin, savedShareSlug)
                : `/flyers/${savedShareSlug}`}
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">저장하면 공유 링크(/flyers/…)가 생성됩니다.</p>
          )}
          {savedDraftId ? (
            <p className="mt-0.5 break-all font-mono text-[10px] text-[var(--text-muted)]">
              관리:{" "}
              {typeof window !== "undefined"
                ? `${window.location.origin}/theall_manager_only/flyers/${savedDraftId}`
                : `…/theall_manager_only/flyers/${savedDraftId}`}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-[var(--border)] lg:w-[min(100%,460px)] lg:border-b-0 lg:border-r">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">템플릿</p>
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FLYER_TEMPLATES.map((t) => {
                const on = templatePickerActiveKey(draft.templateKey) === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTemplateKey(t.key)}
                    className={`rounded-xl border px-2.5 py-2 text-left text-xs transition-colors ${
                      on
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-2 ring-[var(--primary)]/25"
                        : "border-[var(--border)] bg-[var(--surface-muted)]/40 hover:border-[var(--primary)]/35"
                    }`}
                  >
                    <span className="font-semibold text-[var(--text-primary)]">{t.label}</span>
                    <span className="mt-1 block text-[10px] leading-snug text-[var(--text-muted)]">{t.description}</span>
                  </button>
                );
              })}
            </div>

            <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">레이아웃 밀도 (저장됨 · 미리보기/공유 반영)</p>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={draft.layoutOptions.compactMode}
                  onChange={(e) => patchLayoutOptions({ compactMode: e.target.checked })}
                  className="mt-0.5 rounded border-[var(--border)]"
                />
                <span>
                  <span className="font-medium">콤팩트 보기</span>
                  <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                    여백·본문 글자·갤러리 간격을 줄여 스크롤 길이를 짧게 합니다.
                  </span>
                </span>
              </label>
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={draft.layoutOptions.imageDensity === "compact"}
                  onChange={(e) => patchLayoutOptions({ imageDensity: e.target.checked ? "compact" : "normal" })}
                  className="mt-0.5 rounded border-[var(--border)]"
                />
                <span>
                  <span className="font-medium">갤러리 그리드 촘촘히</span>
                  <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                    이미지 썸네일을 2열 위주로 배치합니다.
                  </span>
                </span>
              </label>
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={draft.layoutOptions.spacingMode === "tight"}
                  onChange={(e) => patchLayoutOptions({ spacingMode: e.target.checked ? "tight" : "normal" })}
                  className="mt-0.5 rounded border-[var(--border)]"
                />
                <span>
                  <span className="font-medium">섹션 간격 타이트</span>
                  <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                    카드·블록 사이 세로 간격을 줄입니다.
                  </span>
                </span>
              </label>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectAllSections(true)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:opacity-90"
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={() => selectAllSections(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                전체 해제
              </button>
            </div>

            <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">섹션 편집</p>
            <div className="space-y-2">
              <SectionAccordion
                sectionKey="header"
                open={openSections.header}
                onToggleOpen={() => toggleSectionOpen("header")}
                checked={draft.sections.header}
                onToggleSection={(v) => toggleSection("header", v)}
              >
                <div>
                  <FieldLabel>제목</FieldLabel>
                  <input
                    type="text"
                    value={draft.fields.title}
                    onChange={(e) => updateFields({ title: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <FieldLabel>부제목</FieldLabel>
                  <input
                    type="text"
                    value={draft.fields.subtitle}
                    onChange={(e) => updateFields({ subtitle: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </SectionAccordion>

              <SectionAccordion
                sectionKey="departure"
                open={openSections.departure}
                onToggleOpen={() => toggleSectionOpen("departure")}
                checked={draft.sections.departure}
                onToggleSection={(v) => toggleSection("departure", v)}
              >
                <div>
                  <FieldLabel>출발·일정</FieldLabel>
                  <textarea
                    value={draft.fields.departureText}
                    onChange={(e) => updateFields({ departureText: e.target.value })}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <FieldLabel>미팅 안내</FieldLabel>
                  <textarea
                    value={draft.fields.meetingText}
                    onChange={(e) => updateFields({ meetingText: e.target.value })}
                    rows={2}
                    className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <FieldLabel>항공·편명</FieldLabel>
                  <input
                    type="text"
                    value={draft.fields.airlineText}
                    onChange={(e) => updateFields({ airlineText: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </SectionAccordion>

              <SectionAccordion
                sectionKey="baggage"
                open={openSections.baggage}
                onToggleOpen={() => toggleSectionOpen("baggage")}
                checked={draft.sections.baggage}
                onToggleSection={(v) => toggleSection("baggage", v)}
              >
                <div>
                  <FieldLabel>섹션 제목</FieldLabel>
                  <input
                    type="text"
                    value={draft.fields.baggageTitle}
                    onChange={(e) => updateFields({ baggageTitle: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <FieldLabel>수하물 (줄마다 한 항목)</FieldLabel>
                  <textarea
                    value={linesToMultiline(draft.fields.baggageLines)}
                    onChange={(e) => updateFields({ baggageLines: multilineToLines(e.target.value) })}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                  />
                </div>
              </SectionAccordion>

              <SectionAccordion
                sectionKey="preparation"
                open={openSections.preparation}
                onToggleOpen={() => toggleSectionOpen("preparation")}
                checked={draft.sections.preparation}
                onToggleSection={(v) => toggleSection("preparation", v)}
              >
                <div>
                  <FieldLabel>섹션 제목</FieldLabel>
                  <input
                    type="text"
                    value={draft.fields.preparationTitle}
                    onChange={(e) => updateFields({ preparationTitle: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <FieldLabel>준비물 (줄마다 한 항목)</FieldLabel>
                  <textarea
                    value={linesToMultiline(draft.fields.preparationLines)}
                    onChange={(e) => updateFields({ preparationLines: multilineToLines(e.target.value) })}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">복장·준비물 추천</p>
                    {draft.outfit.isAutoGenerated ? (
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:text-violet-200">
                        자동 생성
                      </span>
                    ) : null}
                  </div>
                  {draft.outfit.summaryText.trim() ? (
                    <p className="mb-2 text-[11px] leading-snug text-[var(--text-secondary)]">{draft.outfit.summaryText}</p>
                  ) : null}
                  {draft.outfit.items.length === 0 ? (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      「날씨 불러오기」 후 자동으로 채워지거나, 아래에서 직접 추가할 수 있습니다.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {draft.outfit.items.map((item, idx) => (
                        <li key={`${item.text}-${idx}`} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={item.included}
                            onChange={() => {
                              const o = draftRef.current.outfit;
                              const items = o.items.map((it, i) =>
                                i === idx ? { ...it, included: !it.included } : it,
                              );
                              patchOutfitUser({ ...o, items });
                            }}
                            className="mt-1 rounded border-[var(--border)]"
                            aria-label={`${item.text} 유인물에 포함`}
                          />
                          <span className="min-w-0 flex-1 text-sm text-[var(--text-primary)]">{item.text}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const o = draftRef.current.outfit;
                              patchOutfitUser({
                                ...o,
                                items: o.items.filter((_, i) => i !== idx),
                              });
                            }}
                            className="shrink-0 text-[11px] text-[var(--text-muted)] hover:text-[var(--danger)]"
                          >
                            삭제
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={outfitNewLine}
                      onChange={(e) => setOutfitNewLine(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const t = outfitNewLine.trim();
                        if (!t) return;
                        const o = draftRef.current.outfit;
                        patchOutfitUser({
                          ...o,
                          items: [...o.items, { text: t, included: true }],
                        });
                        setOutfitNewLine("");
                      }}
                      placeholder="항목 추가 후 Enter 또는 추가"
                      className="min-w-[12rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const t = outfitNewLine.trim();
                        if (!t) return;
                        const o = draftRef.current.outfit;
                        patchOutfitUser({
                          ...o,
                          items: [...o.items, { text: t, included: true }],
                        });
                        setOutfitNewLine("");
                      }}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                    >
                      추가
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                    체크 해제한 항목은 유인물에 나오지 않습니다. 날씨를 다시 불러오면 추천 목록이 새로 덮어씌워집니다.
                  </p>
                </div>
              </SectionAccordion>

              <SectionAccordion
                sectionKey="includedExcluded"
                open={openSections.includedExcluded}
                onToggleOpen={() => toggleSectionOpen("includedExcluded")}
                checked={draft.sections.includedExcluded}
                onToggleSection={(v) => toggleSection("includedExcluded", v)}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>포함 제목</FieldLabel>
                    <input
                      type="text"
                      value={draft.fields.includedTitle}
                      onChange={(e) => updateFields({ includedTitle: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <FieldLabel>포함 (줄마다 한 항목)</FieldLabel>
                    <textarea
                      value={linesToMultiline(draft.fields.includedLines)}
                      onChange={(e) => updateFields({ includedLines: multilineToLines(e.target.value) })}
                      rows={4}
                      className="mt-1 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <FieldLabel>불포함 제목</FieldLabel>
                    <input
                      type="text"
                      value={draft.fields.excludedTitle}
                      onChange={(e) => updateFields({ excludedTitle: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <FieldLabel>불포함 (줄마다 한 항목)</FieldLabel>
                    <textarea
                      value={linesToMultiline(draft.fields.excludedLines)}
                      onChange={(e) => updateFields({ excludedLines: multilineToLines(e.target.value) })}
                      rows={4}
                      className="mt-1 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </SectionAccordion>

              <SectionAccordion
                sectionKey="notice"
                open={openSections.notice}
                onToggleOpen={() => toggleSectionOpen("notice")}
                checked={draft.sections.notice}
                onToggleSection={(v) => toggleSection("notice", v)}
              >
                <div>
                  <FieldLabel>유의사항</FieldLabel>
                  <textarea
                    value={draft.fields.noticeText}
                    onChange={(e) => updateFields({ noticeText: e.target.value })}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </SectionAccordion>

              <SectionAccordion
                sectionKey="weather"
                open={openSections.weather}
                onToggleOpen={() => toggleSectionOpen("weather")}
                checked={draft.sections.weather}
                onToggleSection={(v) => toggleSection("weather", v)}
              >
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3">
                  <p className="mb-2 text-[11px] font-semibold text-[var(--text-muted)]">날씨 자동 조회 (WeatherAPI)</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <FieldLabel>도시·지역 (검색어)</FieldLabel>
                      <input
                        type="text"
                        value={draft.weather.city}
                        onChange={(e) => patchWeather({ city: e.target.value, isLoaded: false })}
                        placeholder="예: Chiang Mai, Bangkok"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <FieldLabel>출발일</FieldLabel>
                      <input
                        type="date"
                        value={draft.weather.startDate}
                        onChange={(e) => patchWeather({ startDate: e.target.value, isLoaded: false })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <FieldLabel>도착일</FieldLabel>
                      <input
                        type="date"
                        value={draft.weather.endDate}
                        onChange={(e) => patchWeather({ endDate: e.target.value, isLoaded: false })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      disabled={weatherLoading || saving}
                      onClick={() => void fetchFlyerWeather(false)}
                      className="w-full rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:opacity-50 sm:w-auto"
                    >
                      {weatherLoading ? "불러오는 중…" : "날씨 불러오기"}
                    </button>
                    <button
                      type="button"
                      disabled={weatherLoading || saving}
                      onClick={() => void fetchFlyerWeather(true)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50 sm:w-auto"
                    >
                      {weatherLoading ? "불러오는 중…" : "최신 날씨로 다시 조회"}
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                    동일 도시·기간은 약 6시간 동안 서버에 캐시되어 빠르게 불러옵니다. 최신 예보가 필요하면 「최신 날씨로 다시 조회」를 사용하세요. 예보는 통상 오늘 기준으로 제공되며, 여행일이 먼 미래면 표시 구간이 달라질 수 있습니다.
                  </p>
                </div>
                {draft.weather.isLoaded && draft.weather.days.length > 0 ? (
                  <div>
                    <FieldLabel>일별 예보 (미리보기 최대 5일)</FieldLabel>
                    <ul className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/20 px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                      {draft.weather.days.slice(0, 8).map((d) => (
                        <li key={d.date}>
                          {d.date}
                          {d.minC != null && d.maxC != null
                            ? ` · ${Math.round(d.minC)}~${Math.round(d.maxC)}°C`
                            : ""}
                          {d.condition ? ` · ${d.condition}` : ""}
                          {d.chanceOfRain != null ? ` · 강수 ${Math.round(d.chanceOfRain)}%` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <FieldLabel>날씨 제목 (유인물)</FieldLabel>
                  <input
                    type="text"
                    value={draft.fields.weatherTitle}
                    onChange={(e) => updateFields({ weatherTitle: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <FieldLabel>날씨 요약 (유인물 본문 · 수정 가능)</FieldLabel>
                  <textarea
                    value={draft.fields.weatherSummary}
                    onChange={(e) => updateFields({ weatherSummary: e.target.value })}
                    rows={4}
                    className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </SectionAccordion>

              <SectionAccordion
                sectionKey="gallery"
                open={openSections.gallery}
                onToggleOpen={() => toggleSectionOpen("gallery")}
                checked={draft.sections.gallery}
                onToggleSection={(v) => toggleSection("gallery", v)}
              >
                <FlyerImageSelector
                  product={product}
                  selected={draft.selectedImageUrls}
                  onChange={(urls) =>
                    commitDraft({
                      ...draftRef.current,
                      selectedImageUrls: urls.slice(0, FLYER_MAX_GALLERY_IMAGES),
                    })
                  }
                />
              </SectionAccordion>

              <SectionAccordion
                sectionKey="footer"
                open={openSections.footer}
                onToggleOpen={() => toggleSectionOpen("footer")}
                checked={draft.sections.footer}
                onToggleSection={(v) => toggleSection("footer", v)}
              >
                <div>
                  <FieldLabel>브랜드명</FieldLabel>
                  <input
                    type="text"
                    value={draft.fields.footerBrandText}
                    onChange={(e) => updateFields({ footerBrandText: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <FieldLabel>하단 안내</FieldLabel>
                  <textarea
                    value={draft.fields.footerInfoText}
                    onChange={(e) => updateFields({ footerInfoText: e.target.value })}
                    rows={2}
                    className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </SectionAccordion>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--surface-muted)]/40">
          <div className="flyer-print-hide flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)]/90 px-3 py-2 backdrop-blur-sm">
            <span className="text-xs font-semibold text-[var(--text-primary)]">{flyerTemplateLabel(draft.templateKey)}</span>
            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)] ring-1 ring-[var(--border)]">
              세로 스크롤 미리보기
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
            {draft.selectedImageUrls.length > FLYER_MAX_GALLERY_IMAGES ? (
              <div className="mb-3 rounded-lg border border-sky-300/50 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-100 print:hidden">
                갤러리는 최대 {FLYER_MAX_GALLERY_IMAGES}장만 표시·저장됩니다. (현재{" "}
                {draft.selectedImageUrls.length}장)
              </div>
            ) : null}
            <div className="flex justify-center">
              <FlyerLongformPreview ref={previewRef} draft={draft} product={product} />
            </div>
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 flex-col gap-3 border-t border-[var(--border)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="order-2 text-xs text-[var(--text-muted)] sm:order-1">{statusLine}</p>
        <div className="order-1 flex flex-wrap justify-end gap-2 sm:order-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveFlyer()}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:opacity-50"
          >
            저장
          </button>
          <button
            type="button"
            disabled={saving || exportPending}
            onClick={() => void copyShareLink()}
            className="rounded-lg border border-violet-300/50 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-900 hover:opacity-90 disabled:opacity-50 dark:border-violet-800 dark:text-violet-100"
          >
            공유 링크 복사
          </button>
          <button
            type="button"
            disabled={saving || exportPending}
            onClick={() => void copyAdminLink()}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
          >
            관리자 링크
          </button>
          <button
            type="button"
            disabled={saving || exportPending}
            onClick={handlePrint}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
          >
            인쇄
          </button>
          <button
            type="button"
            disabled={exportPending || saving}
            onClick={() => void handlePngExport()}
            className="rounded-lg border border-sky-300/50 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-900 hover:opacity-90 disabled:opacity-50 dark:border-sky-800 dark:text-sky-100"
          >
            {exportPending ? "PNG 생성 중…" : "PNG 저장 (전체 세로)"}
          </button>
        </div>
      </footer>
    </div>
  );
}

export function FlyerGenerateModal({
  open,
  product,
  onClose,
  showToast,
  persistedBootstrap = null,
}: FlyerGenerateModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flyer-modal-title"
    >
      {product ? (
        <FlyerModalShell
          key={persistedBootstrap?.id ?? product.id}
          product={product}
          onClose={onClose}
          showToast={showToast}
          persistedBootstrap={persistedBootstrap}
        />
      ) : (
        <div className="flex max-h-[min(90vh,920px)] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <h2 id="flyer-modal-title" className="text-lg font-bold text-[var(--text-primary)]">
              유인물 생성
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <p className="p-6 text-sm text-[var(--text-muted)]">상품 정보가 없습니다.</p>
          <footer className="flex justify-end border-t border-[var(--border)] px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
            >
              닫기
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
