"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { deriveCardAndHeroWebp } from "@/lib/images/deriveCardAndHeroWebp";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ImageUploadFieldProps = {
  value: string;
  onChange: (url: string) => void;
  /** heroUrl 전달. TODO: cardUrl 분리 저장 시 (heroUrl, cardUrl) 시그니처로 확장. docs/design/product-image-card-url-extension.md */
  onUploaded: (url: string) => void;
  placeholder?: string;
  accept?: string;
};

export function ImageUploadField({
  value,
  onChange,
  onUploaded,
  placeholder = "이미지 URL (권장 1200x800)",
  accept = "image/jpeg,image/png,image/webp",
}: ImageUploadFieldProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<{ heroUrl: string; cardUrl: string } | null>(null);
  const [sizeMeta, setSizeMeta] = useState<{
    originalBytes: number;
    heroBytes: number;
    cardBytes: number;
  } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useAdminToast();

  const previewUrl = selectedFile && objectUrl ? objectUrl : value?.trim() || null;

  useEffect(() => {
    if (!selectedFile) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setObjectUrl(null);
    };
  }, [selectedFile]);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        setSelectedFile(null);
        setUploadedUrls(null);
        setSizeMeta(null);
        setWarnings([]);
        return;
      }
      setSelectedFile(file);
      setIsLoading(true);
      setUploadedUrls(null);
      setSizeMeta(null);
      setWarnings([]);
      try {
        const { hero, card, meta, warnings: deriveWarnings } = await deriveCardAndHeroWebp(file);
        if (deriveWarnings?.length) {
          setWarnings(deriveWarnings);
          deriveWarnings.forEach((w) => showToast("warning", w));
        }

        const formData = new FormData();
        formData.append("hero", hero, hero.name);
        formData.append("card", card, card.name);

        const res = await fetch("/api/admin/uploads/image", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "업로드 실패");

        const { heroUrl, cardUrl } = data;
        onUploaded(heroUrl);
        setUploadedUrls({ heroUrl, cardUrl });
        setSizeMeta({
          originalBytes: meta.originalBytes,
          heroBytes: meta.heroBytes,
          cardBytes: meta.cardBytes,
        });
        setSelectedFile(null);

        showToast(
          "success",
          `이미지 업로드 완료 (${formatBytes(meta.originalBytes)} → hero ${formatBytes(meta.heroBytes)} / card ${formatBytes(meta.cardBytes)})`
        );
      } catch (err) {
        showToast("error", err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    [onUploaded, showToast]
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
    if (file && /^image\/(jpeg|png|webp)$/i.test(file.type)) {
      handleFile(file);
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
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
      />

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`relative flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition ${
          isDragging
            ? "border-[#2563eb] bg-blue-50/50"
            : "border-slate-300 bg-slate-50/50 hover:border-slate-400"
        } ${isLoading ? "pointer-events-none opacity-70" : ""}`}
      >
        {previewUrl && (
          <div className="absolute inset-2 flex items-center justify-center overflow-hidden rounded-md">
            <img
              src={previewUrl}
              alt="미리보기"
              className="max-h-[100px] max-w-full object-contain"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <label
            className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition ${
              isLoading
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {isLoading ? "업로드 중…" : "파일 선택"}
            <input
              ref={inputRef}
              type="file"
              accept={accept}
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

      <p className="text-xs text-slate-500">
        권장 사이즈: 1200x800px 이상 (3:2 비율). JPG/PNG/WebP 사용 가능
      </p>

      {sizeMeta && (
        <p className="text-xs text-slate-600">
          용량: 원본 {formatBytes(sizeMeta.originalBytes)} → hero {formatBytes(sizeMeta.heroBytes)}{" "}
          / card {formatBytes(sizeMeta.cardBytes)}
        </p>
      )}
      {uploadedUrls && (
        <div className="space-y-1 text-xs text-slate-600">
          <p>
            <span className="font-medium">hero:</span>{" "}
            <a
              href={uploadedUrls.heroUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              {uploadedUrls.heroUrl.slice(0, 50)}…
            </a>
          </p>
          <p>
            <span className="font-medium">card:</span>{" "}
            <a
              href={uploadedUrls.cardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              {uploadedUrls.cardUrl.slice(0, 50)}…
            </a>
          </p>
        </div>
      )}
      {warnings.length > 0 && (
        <p className="text-xs text-amber-600">{warnings.join(" ")}</p>
      )}
    </div>
  );
}
