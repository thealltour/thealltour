"use client";

import { useMemo, useRef, useState } from "react";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { deriveCardAndHeroWebp } from "@/lib/images/deriveCardAndHeroWebp";

type MultiImageUploadFieldProps = {
  value: string[];
  onChange: (urls: string[]) => void;
  maxCount?: number;
};

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  urls.forEach((raw) => {
    const url = raw.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push(url);
  });
  return result;
}

export function MultiImageUploadField({ value, onChange, maxCount = 10 }: MultiImageUploadFieldProps) {
  const { showToast } = useAdminToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const urls = useMemo(() => uniqueUrls(value ?? []), [value]);

  function update(next: string[]) {
    onChange(uniqueUrls(next).slice(0, maxCount));
  }

  function moveItem(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= urls.length || to >= urls.length) return;
    const copied = [...urls];
    const [item] = copied.splice(from, 1);
    copied.splice(to, 0, item);
    update(copied);
  }

  async function uploadFiles(files: FileList | File[]) {
    const selected = Array.from(files).filter((f) => /^image\/(jpeg|png|webp)$/i.test(f.type));
    if (selected.length === 0) {
      showToast("warning", "JPG/PNG/WebP 파일만 업로드할 수 있습니다.");
      return;
    }
    const remain = maxCount - urls.length;
    if (remain <= 0) {
      showToast("warning", `이미지는 최대 ${maxCount}장까지 등록할 수 있습니다.`);
      return;
    }
    const targets = selected.slice(0, remain);
    if (targets.length < selected.length) {
      showToast("warning", `최대 ${maxCount}장까지만 업로드됩니다.`);
    }

    setIsUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of targets) {
        const { hero } = await deriveCardAndHeroWebp(file);
        const formData = new FormData();
        formData.append("hero", hero, hero.name);
        const res = await fetch("/api/admin/uploads/image", { method: "POST", body: formData });
        let data: { heroUrl?: string; url?: string; error?: string } = {};
        try {
          data = (await res.json()) as { heroUrl?: string; url?: string; error?: string };
        } catch {
          data = {};
        }
        if (!res.ok) throw new Error(data.error ?? "업로드 실패");
        const url = data.heroUrl ?? data.url;
        if (typeof url === "string" && url.trim()) {
          uploaded.push(url.trim());
        }
      }
      if (uploaded.length === 0) {
        showToast("warning", "업로드된 이미지가 없습니다.");
        return;
      }
      update([...urls, ...uploaded]);
      showToast("success", `${uploaded.length}장 업로드 완료`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingFiles(true);
        }}
        onDragLeave={() => setIsDraggingFiles(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingFiles(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-4 transition ${
          isDraggingFiles ? "border-[#2563eb] bg-blue-50/60" : "border-slate-300 bg-slate-50/50"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition ${
              isUploading
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {isUploading ? "업로드 중…" : "이미지 여러 장 선택"}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={isUploading}
              onChange={(e) => {
                if (e.target.files) void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-xs text-slate-500">드래그 앤 드롭 가능 · 최대 {maxCount}장</span>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="이미지 URL 직접 추가"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
        />
        <button
          type="button"
          onClick={() => {
            const next = urlInput.trim();
            if (!next) return;
            if (urls.length >= maxCount) {
              showToast("warning", `이미지는 최대 ${maxCount}장까지 등록할 수 있습니다.`);
              return;
            }
            update([...urls, next]);
            setUrlInput("");
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          URL 추가
        </button>
      </div>

      {urls.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            등록 이미지 {urls.length}장 (첫 번째가 대표 이미지)
          </p>
          <div className="grid gap-2">
            {urls.map((url, index) => (
              <div
                key={`${url}-${index}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex == null) return;
                  moveItem(dragIndex, index);
                  setDragIndex(null);
                }}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2"
              >
                <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded bg-slate-100">
                  <img
                    src={normalizeProductImageUrl(url)}
                    alt={`상품 이미지 ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-600">{url}</p>
                  {index === 0 ? (
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      대표
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(index, index - 1)}
                    className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, index + 1)}
                    className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => update(urls.filter((_, i) => i !== index))}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">아직 등록된 이미지가 없습니다.</p>
      )}
    </div>
  );
}
