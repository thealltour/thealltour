"use client";

import { useCallback, useRef, useState } from "react";
import { X } from "lucide-react";
import type { CropRect } from "@/lib/pdf/renderFirstPageToWebp";

type ThumbnailCropSelectorProps = {
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
  onConfirm: (cropRect: CropRect) => void;
  onCancel: () => void;
};

const MIN_SIZE = 40;

export function ThumbnailCropSelector({
  imageDataUrl,
  imageWidth,
  imageHeight,
  onConfirm,
  onCancel,
}: ThumbnailCropSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<CropRect | null>(() => {
    const w = imageWidth;
    const h = imageHeight;
    const size = Math.min(w, h) * 0.8;
    const x = (w - size) / 2;
    const y = (h - size) / 2;
    return { x, y, width: size, height: size };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"move" | "resize-se" | "resize-sw" | "resize-ne" | "resize-nw" | "resize-n" | "resize-s" | "resize-e" | "resize-w" | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; sel: CropRect } | null>(null);

  const getImageRect = useCallback(() => {
    const el = containerRef.current;
    if (!el) return null;
    const img = el.querySelector("img");
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }, []);

  const screenToImage = useCallback(
    (clientX: number, clientY: number) => {
      const r = getImageRect();
      if (!r) return { x: 0, y: 0 };
      const scaleX = imageWidth / r.width;
      const scaleY = imageHeight / r.height;
      return {
        x: ((clientX - r.left) / r.width) * imageWidth,
        y: ((clientY - r.top) / r.height) * imageHeight,
      };
    },
    [getImageRect, imageWidth, imageHeight]
  );

  const clampRect = useCallback(
    (r: CropRect): CropRect => {
      let { x, y, width, height } = r;
      width = Math.max(MIN_SIZE, Math.min(width, imageWidth));
      height = Math.max(MIN_SIZE, Math.min(height, imageHeight));
      x = Math.max(0, Math.min(x, imageWidth - width));
      y = Math.max(0, Math.min(y, imageHeight - height));
      return { x, y, width, height };
    },
    [imageWidth, imageHeight]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!selection) return;
      const { x, y } = screenToImage(e.clientX, e.clientY);
      const { x: sx, y: sy, width: sw, height: sh } = selection;

      const margin = 8;
      const inSe = x >= sx + sw - margin && y >= sy + sh - margin && x <= sx + sw + margin && y <= sy + sh + margin;
      const inSw = x >= sx - margin && y >= sy + sh - margin && x <= sx + margin && y <= sy + sh + margin;
      const inNe = x >= sx + sw - margin && y >= sy - margin && x <= sx + sw + margin && y <= sy + margin;
      const inNw = x >= sx - margin && y >= sy - margin && x <= sx + margin && y <= sy + margin;
      const inN = y >= sy - margin && y <= sy + margin && x >= sx + margin && x <= sx + sw - margin;
      const inS = y >= sy + sh - margin && y <= sy + sh + margin && x >= sx + margin && x <= sx + sw - margin;
      const inE = x >= sx + sw - margin && x <= sx + sw + margin && y >= sy + margin && y <= sy + sh - margin;
      const inW = x >= sx - margin && x <= sx + margin && y >= sy + margin && y <= sy + sh - margin;
      const inBody = x >= sx && x <= sx + sw && y >= sy && y <= sy + sh;

      if (inSe) setDragMode("resize-se");
      else if (inSw) setDragMode("resize-sw");
      else if (inNe) setDragMode("resize-ne");
      else if (inNw) setDragMode("resize-nw");
      else if (inN) setDragMode("resize-n");
      else if (inS) setDragMode("resize-s");
      else if (inE) setDragMode("resize-e");
      else if (inW) setDragMode("resize-w");
      else if (inBody) setDragMode("move");
      else {
        const newSel = clampRect({ x, y, width: MIN_SIZE, height: MIN_SIZE });
        setSelection(newSel);
        setDragMode("resize-se");
        setIsDragging(true);
        dragStartRef.current = { x, y, sel: newSel };
        return;
      }
      setIsDragging(true);
      dragStartRef.current = { x, y, sel: { ...selection } };
    },
    [selection, screenToImage, clampRect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStartRef.current || !selection) return;
      const { x: currX, y: currY } = screenToImage(e.clientX, e.clientY);
      const { x: startX, y: startY, sel } = dragStartRef.current;
      const dx = currX - startX;
      const dy = currY - startY;

      let next: CropRect;
      switch (dragMode) {
        case "move":
          next = clampRect({ ...sel, x: sel.x + dx, y: sel.y + dy });
          dragStartRef.current = { x: currX, y: currY, sel: next };
          break;
        case "resize-se":
          next = clampRect({ ...sel, width: Math.max(MIN_SIZE, sel.width + dx), height: Math.max(MIN_SIZE, sel.height + dy) });
          break;
        case "resize-sw":
          next = clampRect({ x: sel.x + dx, y: sel.y, width: Math.max(MIN_SIZE, sel.width - dx), height: Math.max(MIN_SIZE, sel.height + dy) });
          dragStartRef.current = { x: currX, y: startY, sel: next };
          break;
        case "resize-ne":
          next = clampRect({ x: sel.x, y: sel.y + dy, width: Math.max(MIN_SIZE, sel.width + dx), height: Math.max(MIN_SIZE, sel.height - dy) });
          dragStartRef.current = { x: startX, y: currY, sel: next };
          break;
        case "resize-nw":
          next = clampRect({ x: sel.x + dx, y: sel.y + dy, width: Math.max(MIN_SIZE, sel.width - dx), height: Math.max(MIN_SIZE, sel.height - dy) });
          dragStartRef.current = { x: currX, y: currY, sel: next };
          break;
        case "resize-n":
          next = clampRect({ ...sel, y: sel.y + dy, height: Math.max(MIN_SIZE, sel.height - dy) });
          dragStartRef.current = { x: startX, y: currY, sel: next };
          break;
        case "resize-s":
          next = clampRect({ ...sel, height: Math.max(MIN_SIZE, sel.height + dy) });
          break;
        case "resize-e":
          next = clampRect({ ...sel, width: Math.max(MIN_SIZE, sel.width + dx) });
          break;
        case "resize-w":
          next = clampRect({ ...sel, x: sel.x + dx, width: Math.max(MIN_SIZE, sel.width - dx) });
          dragStartRef.current = { x: currX, y: startY, sel: next };
          break;
        default:
          return;
      }
      setSelection(next);
    },
    [isDragging, dragMode, screenToImage, clampRect, selection]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragMode(null);
    dragStartRef.current = null;
  }, []);

  const handleConfirm = useCallback(() => {
    if (selection) onConfirm(selection);
  }, [selection, onConfirm]);

  if (!selection) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--overlay)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--divider)] bg-[var(--surface-elevated)] px-4 py-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">썸네일 영역 선택</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
          >
            <X className="h-4 w-4" />
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)]"
          >
            선택한 영역 썸네일로 지정
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-auto bg-[var(--surface-elevated)] p-4"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="relative inline-block max-h-full max-w-full">
          <img
            src={imageDataUrl}
            alt="PDF 1페이지"
            className="max-h-[70vh] max-w-full select-none"
            draggable={false}
            style={{ width: "auto", height: "auto", display: "block" }}
          />
          <div
            className="absolute inset-0 cursor-crosshair"
            onMouseDown={handleMouseDown}
          >
            <div
              className="absolute border-2 border-[var(--primary)] bg-[var(--primary)]/20"
              style={{
                left: `${(selection.x / imageWidth) * 100}%`,
                top: `${(selection.y / imageHeight) * 100}%`,
                width: `${(selection.width / imageWidth) * 100}%`,
                height: `${(selection.height / imageHeight) * 100}%`,
              }}
            >
              <div className="absolute -right-1.5 -bottom-1.5 h-4 w-4 cursor-se-resize rounded-full border-2 border-[var(--surface)] bg-[var(--primary)]" />
            </div>
          </div>
        </div>
      </div>
      <p className="shrink-0 px-4 py-2 text-center text-xs text-[var(--text-muted)]">
        영역을 드래그하여 이동·리사이즈할 수 있습니다. 빈 곳을 클릭하면 새 영역을 지정합니다.
      </p>
    </div>
  );
}
