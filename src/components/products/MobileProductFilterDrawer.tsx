"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ProductFiltersState } from "@/lib/productFilters";
import { PRODUCT_FILTER_KEYS } from "@/lib/productFilters";
import { cn } from "@/lib/cn";

export type MobileProductFilterDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  regionOptions: string[];
  themeOptions: string[];
  filters: ProductFiltersState;
  onApply: (next: Pick<ProductFiltersState, "region" | "theme">) => void;
  onReset: () => void;
};

type DraftState = { region: string | null; theme: string | null };

export function MobileProductFilterDrawer({
  isOpen,
  onClose,
  regionOptions,
  themeOptions,
  filters,
  onApply,
  onReset,
}: MobileProductFilterDrawerProps) {
  const [draft, setDraft] = useState<DraftState>({
    region: filters.region,
    theme: filters.theme,
  });

  useEffect(() => {
    if (!isOpen) return;
    setDraft({ region: filters.region, theme: filters.theme });
  }, [isOpen, filters.region, filters.theme]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  function handleApply() {
    onApply({ region: draft.region, theme: draft.theme });
    onClose();
  }

  function handleReset() {
    setDraft({ region: null, theme: null });
    onReset();
    onClose();
  }

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="필터"
    >
      <button
        type="button"
        aria-label="배경 닫기"
        className="absolute inset-0 bg-[var(--overlay)]"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[85vh] flex-col rounded-t-2xl border border-b-0 border-[var(--border)]",
          "bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)]",
          "safe-bottom",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--divider)] px-4 py-3">
          <h2 className="type-small font-semibold text-[var(--foreground)]">필터</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors active:bg-[var(--surface-muted)]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <fieldset className="space-y-3">
            <legend className="type-small font-semibold text-[var(--foreground)]">지역</legend>
            <ul className="space-y-1">
              <li>
                <label className="flex cursor-pointer items-center gap-3 py-2.5">
                  <input
                    type="radio"
                    name={`${PRODUCT_FILTER_KEYS.REGION}-mobile`}
                    checked={!draft.region}
                    onChange={() => setDraft((p) => ({ ...p, region: null }))}
                    className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus-visible:ring-[var(--focus-ring)]"
                  />
                  <span className="type-small text-[var(--text-primary)]">전체</span>
                </label>
              </li>
              {regionOptions.map((name) => (
                <li key={name}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5">
                    <input
                      type="radio"
                      name={`${PRODUCT_FILTER_KEYS.REGION}-mobile`}
                      checked={draft.region === name}
                      onChange={() => setDraft((p) => ({ ...p, region: name }))}
                      className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus-visible:ring-[var(--focus-ring)]"
                    />
                    <span className="type-small text-[var(--text-primary)]">{name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="mt-6 space-y-3">
            <legend className="type-small font-semibold text-[var(--foreground)]">테마</legend>
            <ul className="space-y-1">
              <li>
                <label className="flex cursor-pointer items-center gap-3 py-2.5">
                  <input
                    type="radio"
                    name={`${PRODUCT_FILTER_KEYS.THEME}-mobile`}
                    checked={!draft.theme}
                    onChange={() => setDraft((p) => ({ ...p, theme: null }))}
                    className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus-visible:ring-[var(--focus-ring)]"
                  />
                  <span className="type-small text-[var(--text-primary)]">전체</span>
                </label>
              </li>
              {themeOptions.map((name) => (
                <li key={name}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5">
                    <input
                      type="radio"
                      name={`${PRODUCT_FILTER_KEYS.THEME}-mobile`}
                      checked={draft.theme === name}
                      onChange={() => setDraft((p) => ({ ...p, theme: name }))}
                      className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus-visible:ring-[var(--focus-ring)]"
                    />
                    <span className="type-small text-[var(--text-primary)]">{name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[var(--divider)] p-4 safe-bottom">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 rounded-xl border border-[var(--border)] bg-transparent py-3 type-small font-semibold text-[var(--text-primary)] transition-colors active:bg-[var(--surface-muted)]"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 rounded-xl bg-[var(--primary)] py-3 type-small font-semibold text-[var(--on-primary)] transition-opacity active:opacity-90"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
