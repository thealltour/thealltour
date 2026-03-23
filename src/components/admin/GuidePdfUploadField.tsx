"use client";

import { useCallback, useState } from "react";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import {
  renderFirstPageToDataUrl,
  cropFirstPageToWebp,
  type CropRect,
} from "@/lib/pdf/renderFirstPageToWebp";
import { ThumbnailCropSelector } from "@/components/admin/ThumbnailCropSelector";
import { deleteStorageUrlsClient } from "@/lib/admin/deleteStorageUrlsClient";
import { Trash2, Upload } from "lucide-react";

type GuidePdfUploadFieldProps = {
  pdfUrl: string;
  thumbnailUrl: string;
  onChange: (result: { pdfUrl: string; thumbnailUrl: string }) => void;
  /** 교체/삭제 시 Supabase guide-pdfs 버킷 객체 삭제 */
  purgeStorageOnRemove?: boolean;
};

export function GuidePdfUploadField({
  pdfUrl,
  thumbnailUrl,
  onChange,
  purgeStorageOnRemove = true,
}: GuidePdfUploadFieldProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cropState, setCropState] = useState<{
    file: File;
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const { showToast } = useAdminToast();

  const uploadPdfAndThumb = useCallback(
    async (file: File, thumbFile: File) => {
      if (purgeStorageOnRemove) {
        const oldUrls = [pdfUrl, thumbnailUrl].map((u) => u.trim()).filter(Boolean);
        if (oldUrls.length > 0) {
          try {
            const r = await deleteStorageUrlsClient(oldUrls);
            if (r.errors.length > 0) {
              showToast("warning", `기존 파일 스토리지 삭제: ${r.errors.join(" ")}`);
            }
          } catch (e) {
            showToast(
              "warning",
              e instanceof Error ? e.message : "기존 파일 스토리지 삭제에 실패했습니다. 업로드는 계속합니다.",
            );
          }
        }
      }

      const formData = new FormData();
      formData.append("pdf", file, file.name);
      formData.append("thumb", thumbFile, thumbFile.name);

      const res = await fetch("/api/admin/uploads/guide", {
        method: "POST",
        body: formData,
      });

      type ResData = { pdfUrl?: string; thumbnailUrl?: string; error?: string };
      let data: ResData;
      try {
        const text = await res.text();
        data = text ? (JSON.parse(text) as ResData) : {};
      } catch {
        if (res.status === 413) {
          setErrorMessage("파일 용량이 너무 큽니다. PDF는 100MB 이하로 올려주세요.");
          showToast("error", "파일 용량이 너무 큽니다. PDF는 100MB 이하로 올려주세요.");
          return;
        }
        setErrorMessage("서버 응답을 처리할 수 없습니다. 파일 용량(100MB 이하)을 확인해 주세요.");
        showToast("error", "서버 응답을 처리할 수 없습니다. 파일 용량(100MB 이하)을 확인해 주세요.");
        return;
      }

      if (!res.ok) {
        const msg = data.error ?? "업로드에 실패했습니다.";
        setErrorMessage(msg);
        showToast("error", msg);
        return;
      }

      const newPdfUrl = data.pdfUrl ?? "";
      const newThumbUrl = data.thumbnailUrl ?? "";
      onChange({ pdfUrl: newPdfUrl, thumbnailUrl: newThumbUrl });
      showToast("success", "PDF와 썸네일이 업로드되었습니다.");
    },
    [onChange, showToast, pdfUrl, thumbnailUrl, purgeStorageOnRemove]
  );

  const handleClearFiles = useCallback(async () => {
    const oldUrls = [pdfUrl, thumbnailUrl].map((u) => u.trim()).filter(Boolean);
    setIsPurging(true);
    try {
      if (purgeStorageOnRemove && oldUrls.length > 0) {
        try {
          const r = await deleteStorageUrlsClient(oldUrls);
          if (r.errors.length > 0) {
            showToast("warning", r.errors.join(" "));
          } else if (r.deletedPaths.length > 0) {
            showToast("success", "스토리지에서 PDF·썸네일을 삭제했습니다.");
          }
        } catch (e) {
          showToast("error", e instanceof Error ? e.message : "스토리지 삭제에 실패했습니다.");
          return;
        }
      }
      onChange({ pdfUrl: "", thumbnailUrl: "" });
    } finally {
      setIsPurging(false);
    }
  }, [pdfUrl, thumbnailUrl, purgeStorageOnRemove, onChange, showToast]);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        setErrorMessage(null);
        return;
      }
      if (file.type !== "application/pdf") {
        setErrorMessage("PDF 파일만 업로드할 수 있습니다.");
        showToast("error", "PDF 파일만 업로드할 수 있습니다.");
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const { dataUrl, width, height } = await renderFirstPageToDataUrl(file);
        setCropState({ file, dataUrl, width, height });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "PDF 로드 중 오류가 발생했습니다.";
        setErrorMessage(msg);
        showToast("error", msg);
      } finally {
        setIsLoading(false);
      }
    },
    [showToast]
  );

  const handleCropConfirm = useCallback(
    async (cropRect: CropRect) => {
      if (!cropState) return;
      const { file } = cropState;
      setIsLoading(true);
      try {
        const { thumbFile } = await cropFirstPageToWebp(file, cropRect);
        setCropState(null);
        await uploadPdfAndThumb(file, thumbFile);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "썸네일 생성 중 오류가 발생했습니다.";
        setErrorMessage(msg);
        showToast("error", msg);
      } finally {
        setIsLoading(false);
      }
    },
    [cropState, uploadPdfAndThumb, showToast]
  );

  const handleCropCancel = useCallback(() => {
    setCropState(null);
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") {
      handleFile(file);
    } else {
      setErrorMessage("PDF 파일만 업로드할 수 있습니다.");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-2">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition ${
          isDragging
            ? "border-[var(--primary)] bg-[var(--primary-soft)]"
            : "border-[var(--border)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)]"
        } ${isLoading || isPurging ? "pointer-events-none opacity-70" : ""}`}
      >
        {thumbnailUrl?.trim() ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">썸네일 미리보기</p>
              <img
                src={thumbnailUrl}
                alt="가이드 PDF 썸네일"
                className="max-h-24 rounded border border-[var(--border)] object-contain"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              {pdfUrl?.trim() && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
                >
                  PDF 열기 →
                </a>
              )}
              <p className="text-xs text-[var(--text-muted)]">
                새 PDF를 선택하면 기존 파일을 교체합니다. (가능하면 스토리지에서 이전 파일도 삭제합니다.)
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <label
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              isLoading || isPurging
                ? "cursor-not-allowed border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            <Upload className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {isLoading ? "업로드 중…" : thumbnailUrl?.trim() ? "PDF 교체" : "PDF 선택"}
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              disabled={isLoading || isPurging}
              onChange={onFileSelect}
            />
          </label>
          {(pdfUrl?.trim() || thumbnailUrl?.trim()) && (
            <button
              type="button"
              disabled={isLoading || isPurging}
              onClick={() => void handleClearFiles()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm font-medium text-[var(--danger)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              {isPurging ? "삭제 중…" : "파일 삭제"}
            </button>
          )}
          <span className="text-xs text-[var(--text-muted)]">
            {isDragging ? "여기에 놓기" : "또는 드래그 앤 드롭"}
          </span>
        </div>
      </div>

      {errorMessage && (
        <p className="text-sm text-[var(--danger)]">{errorMessage}</p>
      )}

      {cropState && (
        <ThumbnailCropSelector
          imageDataUrl={cropState.dataUrl}
          imageWidth={cropState.width}
          imageHeight={cropState.height}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
