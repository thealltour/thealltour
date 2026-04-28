"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { DownloadProductImagesOptions, ImageFileNamingMode, ImageOutputFormat } from "@/lib/images/imageDownload.types";
import {
  BLOG_FRIENDLY_DEFAULT_QUALITY,
  NAVER_BLOG_IMAGE_MAX_BYTES,
} from "@/lib/images/imageDownloadPreset.storage";

const QUALITY_MIN = 0.6;
const QUALITY_MAX = 1;
const QUALITY_STEP = 0.05;

export type ProductImageDownloadOptionsModalProps = {
  open: boolean;
  productTitle: string;
  initialFormat: ImageOutputFormat;
  initialQuality: number;
  initialNamingMode: ImageFileNamingMode;
  onClose: () => void;
  onConfirm: (options: DownloadProductImagesOptions) => void;
};

export default function ProductImageDownloadOptionsModal({
  open,
  productTitle,
  initialFormat,
  initialQuality,
  initialNamingMode,
  onClose,
  onConfirm,
}: ProductImageDownloadOptionsModalProps) {
  const [format, setFormat] = useState<ImageOutputFormat>("jpg");
  const [quality, setQuality] = useState(BLOG_FRIENDLY_DEFAULT_QUALITY);
  const [namingMode, setNamingMode] = useState<ImageFileNamingMode>("detailed");

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setFormat(initialFormat);
      setQuality(initialQuality);
      setNamingMode(initialNamingMode);
    });
  }, [open, initialFormat, initialQuality, initialNamingMode]);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm({
      format,
      namingMode,
      maxBytesPerImage: NAVER_BLOG_IMAGE_MAX_BYTES,
      ...(format === "jpg" ? { quality } : {}),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-download-options-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="image-download-options-title"
              className="text-base font-bold text-[var(--text-primary)]"
            >
              이미지 ZIP 옵션
            </h2>
            <p className="mt-1 truncate text-xs text-[var(--text-muted)]" title={productTitle}>
              {productTitle || "(제목 없음)"}
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

        <div className="space-y-5 px-4 py-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-[var(--text-primary)]">출력 포맷</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="radio"
                name="zip-format"
                checked={format === "png"}
                onChange={() => setFormat("png")}
                className="accent-[var(--primary)]"
              />
              PNG
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="radio"
                name="zip-format"
                checked={format === "jpg"}
                onChange={() => setFormat("jpg")}
                className="accent-[var(--primary)]"
              />
              JPG (블로그 추천)
            </label>
          </fieldset>

          <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 px-3 py-2 text-[11px] leading-snug text-[var(--text-muted)]">
            네이버 블로그 업로드를 고려해 이미지 1장당 20MB를 넘기면 자동으로 압축 또는 리사이즈를 시도합니다.
          </p>

          {format === "jpg" ? (
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 px-3 py-3">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                JPG 품질{" "}
                <span className="font-mono text-[var(--text-secondary)]">{quality.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={QUALITY_MIN}
                max={QUALITY_MAX}
                step={QUALITY_STEP}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
              <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                <span>용량 작음</span>
                <span>고화질 / 용량 큼</span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">
                투명 배경은 흰색으로 합성됩니다.
              </p>
            </div>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-[var(--text-primary)]">파일명 규칙</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="radio"
                name="zip-naming"
                checked={namingMode === "detailed"}
                onChange={() => setNamingMode("detailed")}
                className="accent-[var(--primary)]"
              />
              상세 (일차·이벤트·출처 포함, 추천)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="radio"
                name="zip-naming"
                checked={namingMode === "simple"}
                onChange={() => setNamingMode("simple")}
                className="accent-[var(--primary)]"
              />
              간단 (cover / gallery_NN / image_NN)
            </label>
          </fieldset>

          <p className="text-[11px] text-[var(--text-muted)]">
            자주 쓰는 조합은 preset 관리에서 저장하고 기본값·빠른 실행을 설정할 수 있습니다.
          </p>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
          >
            다운로드 시작
          </button>
        </footer>
      </div>
    </div>
  );
}
