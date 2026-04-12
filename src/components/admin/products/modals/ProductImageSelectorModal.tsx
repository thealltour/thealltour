"use client";

import { X } from "lucide-react";
import type { Product } from "@/types/product";
import type { ProductImageEntry } from "@/lib/images/imageDownload.types";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

const SOURCE_LABEL: Record<ProductImageEntry["source"], string> = {
  cover: "대표",
  gallery: "갤러리",
  "itinerary-media": "일정 미디어",
  "structured-day-cover": "일차 커버",
  "structured-event-image": "일정 이미지",
  "v2-day-cover": "일차 커버",
  "v2-event-image": "일정 이미지",
};

function entryCaption(entry: ProductImageEntry): string {
  const src = SOURCE_LABEL[entry.source] ?? entry.source;
  const parts: string[] = [src];
  if (entry.dayNumber != null) parts.push(`Day ${entry.dayNumber}`);
  if (entry.eventHeading?.trim()) {
    const h = entry.eventHeading.trim();
    parts.push(h.length > 24 ? `${h.slice(0, 24)}…` : h);
  }
  return parts.join(" · ");
}

export type ProductImageSelectorModalProps = {
  open: boolean;
  product: Product | null;
  entries: ProductImageEntry[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ProductImageSelectorModal({
  open,
  product,
  entries,
  selectedIds,
  onToggle,
  onToggleAll,
  onClose,
  onConfirm,
}: ProductImageSelectorModalProps) {
  if (!open || !product) return null;

  const n = entries.length;
  const sel = selectedIds.size;
  const allSelected = n > 0 && sel === n;

  return (
    <div
      className="fixed inset-0 z-[87] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-selector-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,840px)] w-full max-w-4xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="image-selector-title"
              className="text-base font-bold text-[var(--text-primary)]"
            >
              이미지 선택 다운로드
            </h2>
            <p className="mt-1 truncate text-xs text-[var(--text-muted)]" title={product.title ?? ""}>
              {product.title?.trim() || "(제목 없음)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            <span className="tabular-nums text-[var(--primary)]">{sel}</span>
            <span className="text-[var(--text-muted)]"> / {n} 선택됨</span>
          </p>
          <button
            type="button"
            onClick={onToggleAll}
            disabled={n === 0}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
          >
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {n === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--text-muted)]">
              다운로드할 이미지가 없습니다.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {entries.map((entry) => {
                const checked = selectedIds.has(entry.id);
                const inputId = `img-sel-${entry.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
                return (
                  <div
                    key={entry.id}
                    className={`group relative overflow-hidden rounded-lg border-2 transition-colors ${
                      checked
                        ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/25"
                        : "border-[var(--border)] hover:border-[var(--text-muted)]/40"
                    }`}
                  >
                    <label
                      htmlFor={inputId}
                      className="relative block w-full cursor-pointer text-left focus-within:ring-2 focus-within:ring-[var(--primary)]/50"
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(entry.id)}
                        className="sr-only"
                        aria-label={`${entryCaption(entry)} 선택`}
                      />
                      <div className="relative aspect-square w-full bg-[var(--surface-muted)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={normalizeProductImageUrl(entry.url)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                        <div
                          className={`pointer-events-none absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)]/95 shadow-sm transition-opacity ${
                            checked ? "opacity-100" : "opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                          }`}
                          aria-hidden
                        >
                          <span
                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border-2 ${
                              checked
                                ? "border-[var(--primary)] bg-[var(--primary)]"
                                : "border-[var(--text-muted)] bg-[var(--surface)]"
                            }`}
                          >
                            {checked ? (
                              <span className="text-[9px] font-bold leading-none text-[var(--on-primary)]">✓</span>
                            ) : null}
                          </span>
                        </div>
                      </div>
                      <div className="border-t border-[var(--border)] bg-[var(--surface)] px-1.5 py-1">
                        <p className="line-clamp-2 text-[10px] leading-tight text-[var(--text-muted)]">
                          {entryCaption(entry)}
                        </p>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            취소
          </button>
          <button
            type="button"
            disabled={sel === 0}
            onClick={onConfirm}
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:opacity-50"
          >
            선택 다운로드
          </button>
        </footer>
      </div>
    </div>
  );
}
