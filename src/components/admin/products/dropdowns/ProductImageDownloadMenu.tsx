"use client";

import { useMemo } from "react";
import { FolderCog, Images, SlidersHorizontal } from "lucide-react";
import type { Product } from "@/types/product";
import type { StoredImageDownloadPreset } from "@/lib/images/imageDownloadPreset.storage";
import { getImageDownloadPresetSummary } from "@/lib/images/getImageDownloadPresetSummary";

export type ProductImageDownloadMenuProps = {
  product: Product;
  presets: StoredImageDownloadPreset[];
  defaultPresetId: string | null;
  recentPresetIds: string[];
  onRunWithPreset: (preset: StoredImageDownloadPreset) => void;
  onOpenOptions: (product: Product) => void;
  onOpenPresetManager: () => void;
  onOpenImageSelector: (product: Product) => void;
  onClose: () => void;
  className?: string;
};

function MenuDivider() {
  return <div className="my-1 border-t border-[var(--border)]" role="separator" />;
}

function PresetRowButton(props: {
  preset: StoredImageDownloadPreset;
  isDefault: boolean;
  onPick: () => void;
}) {
  const { preset, isDefault, onPick } = props;
  const summary = getImageDownloadPresetSummary(preset);
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
    >
      <span className="flex w-full min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{preset.name}</span>
        {isDefault ? (
          <span className="shrink-0 rounded-full bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--primary)]">
            기본
          </span>
        ) : null}
      </span>
      <span className="font-mono text-[11px] text-[var(--text-muted)]">{summary}</span>
    </button>
  );
}

export default function ProductImageDownloadMenu({
  product,
  presets,
  defaultPresetId,
  recentPresetIds,
  onRunWithPreset,
  onOpenOptions,
  onOpenPresetManager,
  onOpenImageSelector,
  onClose,
  className = "",
}: ProductImageDownloadMenuProps) {
  const byId = useMemo(() => {
    const m = new Map<string, StoredImageDownloadPreset>();
    for (const p of presets) m.set(p.id, p);
    return m;
  }, [presets]);

  const defaultPreset =
    defaultPresetId != null ? (byId.get(defaultPresetId) ?? null) : null;

  const recentPresets = useMemo(() => {
    const out: StoredImageDownloadPreset[] = [];
    for (const id of recentPresetIds) {
      const p = byId.get(id);
      if (!p) continue;
      if (defaultPresetId && p.id === defaultPresetId) continue;
      out.push(p);
    }
    return out;
  }, [recentPresetIds, byId, defaultPresetId]);

  const empty = presets.length === 0;

  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10 ${className}`}
      role="menu"
      aria-label="이미지 ZIP 다운로드"
    >
      {empty ? (
        <p className="px-3 py-2 text-xs text-[var(--text-muted)]">preset이 없습니다.</p>
      ) : (
        <div className="max-h-[min(320px,50vh)] overflow-y-auto overflow-x-hidden">
          {defaultPreset ? (
            <div className="px-2 pb-1 pt-1">
              <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                기본 preset
              </p>
              <button
                type="button"
                onClick={() => onRunWithPreset(defaultPreset)}
                className="w-full rounded-lg border border-indigo-200/80 bg-indigo-50/90 px-3 py-2.5 text-left dark:border-indigo-800 dark:bg-indigo-950/40"
              >
                <span className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">
                  기본 설정으로 다운로드
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-indigo-800/80 dark:text-indigo-200/80">
                  {getImageDownloadPresetSummary(defaultPreset)}
                </span>
              </button>
            </div>
          ) : null}

          {recentPresets.length > 0 ? (
            <div className="px-2 py-1">
              <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                최근 사용
              </p>
              <div className="space-y-0.5">
                {recentPresets.map((p) => (
                  <PresetRowButton
                    key={p.id}
                    preset={p}
                    isDefault={p.id === defaultPresetId}
                    onPick={() => onRunWithPreset(p)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {!empty ? (
            <div className="px-2 py-1">
              <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                전체 preset
              </p>
              <div className="space-y-0.5">
                {presets.map((p) => (
                  <PresetRowButton
                    key={p.id}
                    preset={p}
                    isDefault={p.id === defaultPresetId}
                    onPick={() => onRunWithPreset(p)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <MenuDivider />

      <div className="px-1 py-1">
        <button
          type="button"
          role="menuitem"
          onClick={() => onOpenImageSelector(product)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
        >
          <Images className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          이미지 선택 후 다운로드
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => onOpenOptions(product)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          옵션 선택 후 다운로드
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => onOpenPresetManager()}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
        >
          <FolderCog className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          preset 관리
        </button>
      </div>
    </div>
  );
}
