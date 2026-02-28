"use client";

import { useCallback, useState } from "react";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { renderFirstPageToWebp } from "@/lib/pdf/renderFirstPageToWebp";

type GuidePdfUploadFieldProps = {
  pdfUrl: string;
  thumbnailUrl: string;
  onChange: (result: { pdfUrl: string; thumbnailUrl: string }) => void;
};

export function GuidePdfUploadField({
  pdfUrl,
  thumbnailUrl,
  onChange,
}: GuidePdfUploadFieldProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showToast } = useAdminToast();

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
        const { thumbFile } = await renderFirstPageToWebp(file);

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
      } catch (err) {
        const msg = err instanceof Error ? err.message : "PDF 업로드 중 오류가 발생했습니다.";
        setErrorMessage(msg);
        showToast("error", msg);
      } finally {
        setIsLoading(false);
      }
    },
    [onChange, showToast]
  );

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
            ? "border-[#2563eb] bg-blue-50/50"
            : "border-slate-300 bg-slate-50/50 hover:border-slate-400"
        } ${isLoading ? "pointer-events-none opacity-70" : ""}`}
      >
        {thumbnailUrl?.trim() ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <p className="mb-1 text-xs font-medium text-slate-600">썸네일 미리보기</p>
              <img
                src={thumbnailUrl}
                alt="가이드 PDF 썸네일"
                className="max-h-24 rounded border border-slate-200 object-contain"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              {pdfUrl?.trim() && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
                >
                  PDF 열기 →
                </a>
              )}
              <p className="text-xs text-slate-500">
                새 PDF를 선택하면 기존 파일을 덮어씁니다.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <label
            className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition ${
              isLoading
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {isLoading ? "업로드 중…" : "PDF 선택"}
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              disabled={isLoading}
              onChange={onFileSelect}
            />
          </label>
          <span className="text-xs text-slate-500">
            {isDragging ? "여기에 놓기" : "또는 드래그 앤 드롭"}
          </span>
        </div>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-500">{errorMessage}</p>
      )}
    </div>
  );
}
