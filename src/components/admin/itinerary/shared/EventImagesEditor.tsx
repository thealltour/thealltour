"use client";

import { useMemo, useState } from "react";
import { parseUrls, dedupeUrls, isAllowedUrl, normalizeUrl } from "./urlParser";
import { extractImageUrls } from "@/lib/images/extractImageUrls";

export type EventImageItem = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
};

export type EventImagesEditorProps = {
  value: EventImageItem[];
  onChange: (nextImages: EventImageItem[]) => void;
  mode?: "compact" | "full";
};

type PasteMode = "url" | "html";

function sortByOrder(items: EventImageItem[]): EventImageItem[] {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function EventImagesEditor({
  value,
  onChange,
  mode = "full",
}: EventImagesEditorProps) {
  const [pasteInput, setPasteInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState<PasteMode>("url");
  const [extractedUrls, setExtractedUrls] = useState<string[]>([]);
  const [selectedExtracted, setSelectedExtracted] = useState<Set<string>>(new Set());

  const sortedItems = useMemo(() => sortByOrder(value), [value]);

  const applyPaste = () => {
    const raw = parseUrls(pasteInput);
    const valid: string[] = [];
    const invalid: string[] = [];
    raw.forEach((u) => {
      const n = normalizeUrl(u);
      if (isAllowedUrl(n)) valid.push(n);
      else invalid.push(n);
    });
    const newUrls = dedupeUrls(valid);
    const existingSet = new Set(value.map((i) => normalizeUrl(i.url)));
    const toAdd = newUrls.filter((u) => !existingSet.has(normalizeUrl(u)));
    if (invalid.length > 0) {
      setParseError(`제외된 URL ${invalid.length}개 (http/https만 허용): ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}`);
    } else {
      setParseError(null);
    }
    if (toAdd.length === 0) {
      if (invalid.length === 0) setPasteInput("");
      return;
    }
    const maxOrder = value.length === 0 ? -1 : Math.max(...value.map((i) => i.sortOrder ?? 0));
    const hasCover = value.some((i) => i.isCover);
    const nextItems: EventImageItem[] = [
      ...value,
      ...toAdd.map((url, idx) => ({
        url,
        sortOrder: maxOrder + 1 + idx,
        isCover: !hasCover && idx === 0,
      })),
    ];
    onChange(nextItems);
    setPasteInput("");
    setParseError(null);
  };

  const runExtract = () => {
    const urls = extractImageUrls(pasteInput);
    setExtractedUrls(urls);
    setSelectedExtracted(new Set(urls));
    setParseError(null);
  };

  const toggleExtracted = (url: string) => {
    setSelectedExtracted((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAllExtracted = () => {
    setSelectedExtracted(new Set(extractedUrls));
  };

  const deselectAllExtracted = () => {
    setSelectedExtracted(new Set());
  };

  const addSelectedExtracted = () => {
    const existingSet = new Set(value.map((i) => normalizeUrl(i.url)));
    const toAdd = [...selectedExtracted].filter((u) => !existingSet.has(normalizeUrl(u)));
    if (toAdd.length === 0) return;
    const maxOrder = value.length === 0 ? -1 : Math.max(...value.map((i) => i.sortOrder ?? 0));
    const hasCover = value.some((i) => i.isCover);
    const nextItems: EventImageItem[] = [
      ...value,
      ...toAdd.map((url, idx) => ({
        url,
        sortOrder: maxOrder + 1 + idx,
        isCover: !hasCover && idx === 0,
      })),
    ];
    onChange(nextItems);
    setExtractedUrls([]);
    setSelectedExtracted(new Set());
  };

  const removeAt = (index: number) => {
    const item = sortedItems[index];
    if (!item) return;
    const wasCover = item.isCover;
    const next = value.filter((i) => normalizeUrl(i.url) !== normalizeUrl(item.url));
    if (wasCover && next.length > 0 && !next.some((i) => i.isCover)) {
      next[0] = { ...next[0], isCover: true };
    }
    onChange(next.map((i, idx) => ({ ...i, sortOrder: idx })));
  };

  const setCoverAt = (index: number) => {
    const next = value.map((item, i) => {
      const sortedIdx = sortedItems.findIndex((s) => normalizeUrl(s.url) === normalizeUrl(item.url));
      return { ...item, isCover: sortedIdx === index };
    });
    onChange(next);
  };

  const moveAt = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index <= 0) return;
    if (direction === "down" && index >= sortedItems.length - 1) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = [...sortedItems];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    const next: EventImageItem[] = reordered.map((item, idx) => ({ ...item, sortOrder: idx }));
    onChange(next);
  };

  const isCompact = mode === "compact";

  return (
    <div className="space-y-2">
      {!isCompact && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
              이미지 URL 일괄 추가
            </label>
            <div className="flex rounded border border-[var(--border)] bg-[var(--surface)] p-0.5">
              <button
                type="button"
                onClick={() => setPasteMode("url")}
                className={`rounded px-2 py-1 text-[11px] font-medium ${
                  pasteMode === "url"
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                URL 입력
              </button>
              <button
                type="button"
                onClick={() => setPasteMode("html")}
                className={`rounded px-2 py-1 text-[11px] font-medium ${
                  pasteMode === "html"
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                HTML/소스 붙여넣기
              </button>
            </div>
          </div>
          <textarea
            value={pasteInput}
            onChange={(e) => setPasteInput(e.target.value)}
            onBlur={() => parseError && setParseError(null)}
            placeholder={
              pasteMode === "url"
                ? "URL 한 줄씩 입력 (북마클릿 실행 후 붙여넣기 가능)\n예: https://example.com/1.jpg"
                : "HTML 또는 페이지 소스를 붙여넣으세요. [추출 후 추가]로 이미지 URL을 추출할 수 있습니다."
            }
            rows={3}
            className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            {pasteMode === "url" ? (
              <button
                type="button"
                onClick={applyPaste}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              >
                URL 추가
              </button>
            ) : (
              <button
                type="button"
                onClick={runExtract}
                className="rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--primary)] hover:opacity-90"
              >
                추출 후 추가
              </button>
            )}
            {parseError && (
              <span className="text-[11px] text-[var(--danger)]">{parseError}</span>
            )}
          </div>

          {pasteMode === "html" && extractedUrls.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 p-2 space-y-2">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                {extractedUrls.length}개 추출됨 · 선택한 URL만 추가됩니다
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={selectAllExtracted}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  전체선택
                </button>
                <button
                  type="button"
                  onClick={deselectAllExtracted}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  전체해제
                </button>
                <button
                  type="button"
                  onClick={addSelectedExtracted}
                  disabled={selectedExtracted.size === 0}
                  className="rounded border border-[var(--primary)] bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--primary)] hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
                >
                  선택 추가 ({selectedExtracted.size}개)
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {extractedUrls.map((url) => (
                  <label
                    key={url}
                    className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 cursor-pointer hover:bg-[var(--surface-muted)]/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedExtracted.has(url)}
                      onChange={() => toggleExtracted(url)}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="min-w-0 truncate text-[11px] text-[var(--text-primary)]" title={url}>
                      {url}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {sortedItems.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
            이미지 {sortedItems.length}장 (가로 스크롤)
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sortedItems.map((item, index) => (
              <div
                key={`${normalizeUrl(item.url)}-${index}`}
                className="flex shrink-0 flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2"
              >
                <div className="relative h-16 w-20 overflow-hidden rounded bg-[var(--surface-muted)]">
                  <img
                    src={item.url}
                    alt={item.alt ?? ""}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.background = "var(--surface-muted)";
                    }}
                  />
                  {item.isCover && (
                    <span className="absolute left-0 top-0 rounded-br bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--on-primary)]">
                      대표
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveAt(index, "up")}
                    disabled={index === 0}
                    className="rounded border border-[var(--border)] bg-[var(--surface)] p-0.5 text-[10px] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-40"
                    title="위로"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveAt(index, "down")}
                    disabled={index === sortedItems.length - 1}
                    className="rounded border border-[var(--border)] bg-[var(--surface)] p-0.5 text-[10px] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-40"
                    title="아래로"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverAt(index)}
                    className={`rounded border px-1 py-0.5 text-[10px] font-semibold ${
                      item.isCover
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                    }`}
                    title="대표 지정"
                  >
                    대표
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-1 py-0.5 text-[10px] text-[var(--danger)] hover:opacity-90"
                    title="삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text-muted)]">등록된 이미지가 없습니다.</p>
      )}
    </div>
  );
}
