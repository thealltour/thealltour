"use client";

import { useMemo, useState } from "react";
import { parseUrls, dedupeUrls, isAllowedUrl, normalizeUrl } from "./urlParser";
import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";
import { getEventImageUrl } from "@/lib/images/getEventImageUrl";
import { extractImageUrls } from "@/lib/images/extractImageUrls";
import { normalizeEventImages } from "./normalizeEventImages";
import { getDragData, setDragData, type ModetourImageDragItem } from "@/components/admin/modetour/modetourImageDnd";
import type { ImagePlacementIssue } from "@/components/admin/modetour/modetourImageValidation";

export type EventImageItem = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
};

export type EventImagesEditorDndContext = {
  enabled?: boolean;
  editorType: "v2" | "structured";
  dayIndex: number;
  eventIndex: number;
  onDropExternalImage?: (
    item: ModetourImageDragItem,
    destination: {
      editorType: "v2" | "structured";
      dayIndex: number;
      eventIndex: number;
      insertAt?: number;
    }
  ) => void;
  onReturnImageToPool?: (url: string) => void;
};

export type EventImagesEditorProps = {
  value: EventImageItem[];
  onChange: (nextImages: EventImageItem[]) => void;
  mode?: "compact" | "full";
  dndContext?: EventImagesEditorDndContext;
  /** URL별 검증 이슈 (normalizeImageUrl 기준 키). 개별 이미지 카드에 오류/경고 표시 */
  issuesByUrl?: Record<string, ImagePlacementIssue[]>;
  /** false면 경고는 숨기고 오류만 표시 */
  showWarnings?: boolean;
};

type PasteMode = "url" | "html";

function sortByOrder(items: EventImageItem[]): EventImageItem[] {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

export function EventImagesEditor({
  value,
  onChange,
  mode = "full",
  dndContext,
  issuesByUrl,
  showWarnings = true,
}: EventImagesEditorProps) {
  const [pasteInput, setPasteInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState<PasteMode>("url");
  const [extractedUrls, setExtractedUrls] = useState<string[]>([]);
  const [selectedExtracted, setSelectedExtracted] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [externalDragOver, setExternalDragOver] = useState(false);
  /** drop indicator: hover 중인 카드 인덱스 (sortedItems.length = 끝에 추가) */
  const [hoverImageIndex, setHoverImageIndex] = useState<number | null>(null);
  /** drop indicator: 카드 앞/뒤 */
  const [hoverPosition, setHoverPosition] = useState<"before" | "after" | null>(null);

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
    const existingSet = new Set(value.map((i) => getEventImageUrl(i)));
    const toAdd = newUrls.filter((u) => !existingSet.has(normalizeImageUrl(u)));
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
    onChange(normalizeEventImages(nextItems));
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
    const existingSet = new Set(value.map((i) => getEventImageUrl(i)));
    const toAdd = [...selectedExtracted].filter((u) => !existingSet.has(normalizeImageUrl(u)));
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
    onChange(normalizeEventImages(nextItems));
    setExtractedUrls([]);
    setSelectedExtracted(new Set());
  };

  const removeAt = (index: number) => {
    const item = sortedItems[index];
    if (!item) return;
    if (dndContext?.enabled && dndContext?.onReturnImageToPool) {
      dndContext.onReturnImageToPool(item.url);
    }
    const next = value.filter((i) => getEventImageUrl(i) !== getEventImageUrl(item));
    onChange(normalizeEventImages(next));
  };

  /** Cover 지정: index번째(sorted 기준)만 isCover true, 나머지 false → 정규화 */
  const handleToggleCover = (index: number) => {
    const next = sortedItems.map((img, i) => ({ ...img, isCover: i === index }));
    onChange(normalizeEventImages(next));
  };

  const moveAt = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index <= 0) return;
    if (direction === "down" && index >= sortedItems.length - 1) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = arrayMove(sortedItems, index, swapIndex);
    onChange(normalizeEventImages(reordered));
  };

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    if (dndContext?.enabled && dndContext.editorType != null) {
      const item = sortedItems[index];
      if (item) {
        setDragData(e.dataTransfer, {
          source: "event",
          url: item.url,
          editorType: dndContext.editorType,
          dayIndex: dndContext.dayIndex,
          eventIndex: dndContext.eventIndex,
          imageIndex: index,
        });
      }
    } else {
      e.dataTransfer.setData("text/plain", String(index));
    }
    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
  };

  const clearHover = () => {
    setOverIndex(null);
    setHoverImageIndex(null);
    setHoverPosition(null);
    setExternalDragOver(false);
  };

  const handleDragOverCard = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dndContext?.enabled ? "move" : "move";
    setOverIndex(index);
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;
    const isBefore = e.clientX < midX || e.clientY < midY;
    setHoverImageIndex(index);
    setHoverPosition(isBefore ? "before" : "after");
  };

  const handleDragOverAppend = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(null);
    setHoverImageIndex(sortedItems.length);
    setHoverPosition("after");
    setExternalDragOver(true);
  };

  const handleDragLeave = () => {
    clearHover();
  };

  const handleDragLeaveContainer = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setHoverImageIndex(null);
      setHoverPosition(null);
      setExternalDragOver(false);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    clearHover();
  };

  /** insertAt: 카드 index 기준 before=index, after=index+1; append zone = length */
  const resolveInsertAt = (cardIndex: number, position: "before" | "after"): number =>
    position === "before" ? cardIndex : cardIndex + 1;

  const handleDropCard = (cardIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;
    const position: "before" | "after" = e.clientX < midX || e.clientY < midY ? "before" : "after";
    const insertAt = Math.min(resolveInsertAt(cardIndex, position), sortedItems.length);
    handleDropWithInsertAt(e, insertAt);
  };

  const handleAppendDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleDropWithInsertAt(e, sortedItems.length);
  };

  const handleDropWithInsertAt = (e: React.DragEvent, insertAt: number) => {
    e.preventDefault();
    clearHover();
    const payload = getDragData(e.dataTransfer);

    if (payload && dndContext?.onDropExternalImage) {
      dndContext.onDropExternalImage(payload, {
        editorType: dndContext.editorType,
        dayIndex: dndContext.dayIndex,
        eventIndex: dndContext.eventIndex,
        insertAt,
      });
      return;
    }

    const from = dragIndex;
    if (from != null) {
      const toIndex = from < insertAt ? insertAt - 1 : insertAt;
      if (from !== toIndex) {
        const reordered = arrayMove(sortedItems, from, toIndex);
        onChange(normalizeEventImages(reordered));
      }
      setDragIndex(null);
    }
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    if (dndContext?.enabled) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setExternalDragOver(true);
      if (sortedItems.length === 0) {
        setHoverImageIndex(0);
        setHoverPosition("before");
      }
    }
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setExternalDragOver(false);
      setHoverImageIndex(null);
      setHoverPosition(null);
    }
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const insertAt = sortedItems.length;
    clearHover();
    const payload = getDragData(e.dataTransfer);
    if (payload && dndContext?.onDropExternalImage) {
      dndContext.onDropExternalImage(payload, {
        editorType: dndContext.editorType,
        dayIndex: dndContext.dayIndex,
        eventIndex: dndContext.eventIndex,
        insertAt,
      });
    }
  };

  const isCompact = mode === "compact";

  return (
    <div
      className={`space-y-2 ${externalDragOver && sortedItems.length === 0 ? "rounded-lg ring-2 ring-[var(--primary)] border border-[var(--primary)] bg-[var(--primary-soft)]/30" : ""}`}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleDragLeaveContainer}
      onDrop={handleContainerDrop}
    >
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
            이미지 {sortedItems.length}장 (드래그로 순서 변경)
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">
            첫 번째 이미지가 대표 이미지로 사용됩니다.
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 items-start">
            {sortedItems.map((item, index) => {
              const urlKey = normalizeImageUrl(getEventImageUrl(item));
              const issuesForUrl = urlKey ? issuesByUrl?.[urlKey] : undefined;
              const hasError = issuesForUrl?.some((i) => i.level === "error");
              const hasWarning = showWarnings && issuesForUrl?.some((i) => i.level === "warning");
              const caption =
                hasError && issuesForUrl
                  ? issuesForUrl.find((i) => i.level === "error")?.message ?? "오류"
                  : hasWarning && issuesForUrl
                    ? issuesForUrl.find((i) => i.level === "warning")?.message ?? "경고"
                    : hasError
                      ? "잘못된 이미지 URL"
                      : hasWarning
                        ? "배치 확인 필요"
                        : null;
              return (
              <div key={`${urlKey}-${index}`} className="flex shrink-0 items-center gap-0">
                {/* 카드 앞 drop indicator 라인 (최소 4px로 드롭 가능) */}
                <div
                  className={`h-full min-h-[80px] shrink-0 rounded-full transition ${
                    hoverImageIndex === index && hoverPosition === "before"
                      ? "w-2 bg-[var(--primary)]"
                      : "min-w-[4px] w-1 bg-transparent"
                  }`}
                  onDragOver={handleDragOverCard(index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    clearHover();
                    const payload = getDragData(ev.dataTransfer);
                    if (payload && dndContext?.onDropExternalImage) {
                      dndContext.onDropExternalImage(payload, {
                        editorType: dndContext.editorType,
                        dayIndex: dndContext.dayIndex,
                        eventIndex: dndContext.eventIndex,
                        insertAt: index,
                      });
                      return;
                    }
                    const from = dragIndex;
                    if (from != null) {
                      const toIndex = from < index ? index - 1 : index;
                      if (from !== toIndex) {
                        const reordered = arrayMove(sortedItems, from, toIndex);
                        onChange(normalizeEventImages(reordered));
                      }
                      setDragIndex(null);
                    }
                  }}
                />
                <div
                  className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border bg-[var(--surface)] p-2 transition ${
                    dragIndex === index ? "opacity-50 border-[var(--border)]" : ""
                  } ${overIndex === index ? "ring-2 ring-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]"} ${
                    hoverImageIndex === index && hoverPosition === "after" ? "ring-2 ring-[var(--primary)] ring-offset-1" : ""
                  } ${hasError ? "border-[var(--danger)] ring-1 ring-[var(--danger)]" : ""} ${hasWarning && !hasError ? "border-amber-500/70" : ""}`}
                  onDragOver={handleDragOverCard(index)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDropCard(index)}
                >
                  <div
                  draggable
                  onDragStart={handleDragStart(index)}
                  className="flex w-full cursor-grab active:cursor-grabbing items-center justify-center rounded border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                  title="드래그하여 순서 변경"
                >
                  ≡ 드래그
                </div>
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
                {caption && (
                  <p
                    className={`text-[10px] text-center max-w-[5rem] truncate ${hasError ? "text-[var(--danger)] font-medium" : "text-amber-600 dark:text-amber-400"}`}
                    title={caption}
                  >
                    {hasError ? "오류" : "경고"}
                  </p>
                )}
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
                    onClick={() => handleToggleCover(index)}
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
                    title={
                      dndContext?.enabled && dndContext?.onReturnImageToPool
                        ? "이미지를 이벤트에서 제거합니다. 미할당 이미지로 이동합니다."
                        : "이미지 제거"
                    }
                  >
                    삭제
                  </button>
                </div>
                </div>
              </div>
              );
            })}
            {/* 리스트 끝 "끝에 추가" drop zone */}
            <div
              className={`flex shrink-0 items-center rounded border-2 border-dashed min-w-[24px] min-h-[60px] transition ${
                hoverImageIndex === sortedItems.length && hoverPosition === "after"
                  ? "border-[var(--primary)] bg-[var(--primary-soft)]/20 w-6"
                  : "border-[var(--border)] border-transparent hover:border-[var(--border)]"
              }`}
              onDragOver={handleDragOverAppend}
              onDragLeave={handleDragLeaveContainer}
              onDrop={handleAppendDrop}
            >
              {hoverImageIndex === sortedItems.length && hoverPosition === "after" ? (
                <span className="px-1 text-[10px] text-[var(--primary)]">끝</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p
          className={`rounded border border-dashed px-4 py-8 text-center text-[11px] text-[var(--text-muted)] ${externalDragOver ? "border-[var(--primary)] bg-[var(--primary-soft)]/20" : "border-[var(--border)]"}`}
        >
          {dndContext?.enabled
            ? "이 이벤트에는 아직 배치된 이미지가 없습니다. 미할당 이미지나 다른 이벤트 이미지를 여기로 드래그해 배치할 수 있습니다."
            : "이 이벤트에는 아직 배치된 이미지가 없습니다."}
        </p>
      )}
    </div>
  );
}
