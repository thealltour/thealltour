"use client";

import { MultiImageUploadField } from "@/components/admin/MultiImageUploadField";
import type { VenueInfoItem } from "@/types/product";

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]";

type VenueInfoListEditorProps = {
  title: string;
  itemLabel: string;
  items: VenueInfoItem[];
  onChange: (items: VenueInfoItem[]) => void;
  namePlaceholder: string;
  contentPlaceholder: string;
  description?: string;
  testId?: string;
};

export function VenueInfoListEditor({
  title,
  itemLabel,
  items,
  onChange,
  namePlaceholder,
  contentPlaceholder,
  description,
  testId,
}: VenueInfoListEditorProps) {
  const updateItem = (index: number, patch: Partial<VenueInfoItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-1.5" data-testid={testId}>
      <span className="text-xs font-semibold text-[var(--text-secondary)]">{title}</span>
      {description ? <p className="text-xs text-[var(--text-muted)]">{description}</p> : null}
      <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {itemLabel} {index + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="text-xs text-rose-600 hover:underline"
              >
                삭제
              </button>
            </div>
            <input
              value={item.name}
              onChange={(event) => updateItem(index, { name: event.target.value })}
              placeholder={namePlaceholder}
              aria-label={`${itemLabel} ${index + 1} 이름`}
              className={inputClass}
            />
            <textarea
              value={item.content}
              onChange={(event) => updateItem(index, { content: event.target.value })}
              rows={4}
              placeholder={contentPlaceholder}
              aria-label={`${itemLabel} ${index + 1} 설명`}
              className={`mt-2 ${inputClass}`}
            />
            <div className="mt-2">
              <p className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">
                {itemLabel} 사진 (첫 장이 목록 썸네일)
              </p>
              <MultiImageUploadField
                value={item.images ?? []}
                onChange={(urls) => updateItem(index, { images: urls })}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, { name: "", content: "", images: [] }])}
          className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
        >
          {itemLabel} 추가
        </button>
      </div>
    </div>
  );
}
