"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { MAX_BAND_IMPORT_IMAGE_BYTES } from "@/lib/admin/bandImport/bandImportImageConstants";
export type BandVenueFormRow = {
  name: string;
  content: string;
  files: File[];
};

export function createBandVenueFormRow(): BandVenueFormRow {
  return { name: "", content: "", files: [] };
}

const VENUE_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
const VENUE_IMAGE_RE = /\.(jpe?g|png|webp)$/i;

function FileThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setSrc(reader.result);
    };
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);

  return (
    <li className="relative h-16 w-16 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-muted)]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- 로컬 파일 미리보기(data URL)
        <img src={src} alt={file.name} className="h-full w-full object-cover" />
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${file.name} 제거`}
        className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white hover:bg-black/80"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </li>
  );
}

type BandVenueRowsFieldProps = {
  title: string;
  description: string;
  itemLabel: string;
  namePlaceholder: string;
  contentPlaceholder: string;
  rows: BandVenueFormRow[];
  onChange: (rows: BandVenueFormRow[]) => void;
  onError: (message: string | null) => void;
  fieldClass: string;
};

export default function BandVenueRowsField({
  title,
  description,
  itemLabel,
  namePlaceholder,
  contentPlaceholder,
  rows,
  onChange,
  onError,
  fieldClass,
}: BandVenueRowsFieldProps) {
  const updateRow = (index: number, patch: Partial<BandVenueFormRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addFiles = (index: number, incoming: FileList | null) => {
    if (!incoming?.length) return;
    const row = rows[index];
    const next: File[] = [];
    for (const file of Array.from(incoming)) {
      if (!VENUE_IMAGE_RE.test(file.name.trim())) {
        onError(`${itemLabel} 사진은 jpg, jpeg, png, webp만 올릴 수 있습니다.`);
        return;
      }
      if (file.size > MAX_BAND_IMPORT_IMAGE_BYTES) {
        onError(`${itemLabel} 사진은 한 장에 10MB 이하만 올릴 수 있습니다. (${file.name})`);
        return;
      }
      next.push(file);
    }
    onError(null);
    updateRow(index, { files: [...row.files, ...next] });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...rows, createBandVenueFormRow()])}
          className="shrink-0 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
        >
          {itemLabel} 추가
        </button>
      </div>

      {rows.map((row, index) => (
        <div key={index} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {itemLabel} {index + 1}
            </span>
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                className="text-xs text-rose-600 hover:underline"
              >
                삭제
              </button>
            ) : null}
          </div>
          <input
            className={fieldClass}
            value={row.name}
            onChange={(e) => updateRow(index, { name: e.target.value })}
            placeholder={namePlaceholder}
            aria-label={`${itemLabel} ${index + 1} 이름`}
          />
          <textarea
            className={`${fieldClass} mt-2 min-h-[96px]`}
            value={row.content}
            onChange={(e) => updateRow(index, { content: e.target.value })}
            placeholder={contentPlaceholder}
            aria-label={`${itemLabel} ${index + 1} 설명`}
          />
          <div className="mt-2">
            <ul className="flex flex-wrap gap-2">
              {row.files.map((file, fileIndex) => (
                <FileThumb
                  key={`${file.name}-${file.size}-${fileIndex}`}
                  file={file}
                  onRemove={() =>
                    updateRow(index, { files: row.files.filter((_, i) => i !== fileIndex) })
                  }
                />
              ))}
            </ul>
            <label className="mt-2 inline-flex cursor-pointer text-xs font-medium text-[var(--primary)]">
              {row.files.length > 0 ? "사진 더 추가" : `${itemLabel} 사진 선택`}
              <span className="ml-1 font-normal text-[var(--text-secondary)]">(jpg·png·webp)</span>
              <input
                type="file"
                accept={VENUE_IMAGE_ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(index, e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
