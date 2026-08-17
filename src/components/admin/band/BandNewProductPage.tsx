"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import AdminButton from "@/components/admin/ui/AdminButton";
import AdminImportProgressOverlay from "@/components/admin/ui/AdminImportProgressOverlay";
import { useSimulatedImportProgress } from "@/components/admin/hooks/useSimulatedImportProgress";
import {
  ADMIN_PRODUCTS_QUERY_KEYS,
  ADMIN_PRODUCTS_VIEW,
} from "@/components/admin/products/adminProducts.constants";
import { supabase } from "@/lib/supabase";
import {
  BAND_IMPORT_STAGING_BUCKET,
  MAX_BAND_IMPORT_IMAGE_BYTES,
  MAX_BAND_IMPORT_ZIP_BYTES,
} from "@/lib/admin/bandImport/bandImportImageConstants";

type ImportResponse = {
  id?: string;
  message?: string;
  existingId?: string;
  parsed?: {
    title: string | null;
    price: number | null;
    duration: string | null;
    status: string | null;
  };
};

const HWP_ACCEPT = ".hwp,.hwpx,application/haansofthwp,application/x-hwp";
const HWP_EXT_RE = /\.(hwp|hwpx)$/i;
const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.zip,image/jpeg,image/png,image/webp,application/zip";
const IMAGE_OR_ZIP_RE = /\.(jpe?g|png|webp|zip)$/i;

function isHwpFilename(name: string): boolean {
  return HWP_EXT_RE.test(name.trim());
}

function isImageOrZipFilename(name: string): boolean {
  return IMAGE_OR_ZIP_RE.test(name.trim());
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isZipFilename(name: string): boolean {
  return /\.zip$/i.test(name.trim());
}

function guessContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "zip") return "application/zip";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * zip/사진을 Vercel 함수(4.5MB 요청 본문 제한)를 거치지 않고
 * 브라우저에서 Supabase Storage로 직접 업로드한 뒤 저장 경로만 반환.
 */
async function uploadImageFileToStaging(file: File): Promise<{ path: string; filename: string }> {
  const res = await fetch("/api/admin/products/import-band/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? "업로드 URL 발급에 실패했습니다.");
  }
  const { path, token } = (await res.json()) as { path: string; token: string };

  const { error } = await supabase.storage
    .from(BAND_IMPORT_STAGING_BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType: guessContentType(file) });
  if (error) {
    throw new Error(`사진 업로드에 실패했습니다: ${error.message}`);
  }
  return { path, filename: file.name };
}

export default function BandNewProductPage() {
  const router = useRouter();
  const [bandText, setBandText] = useState("");
  const [golfCourseInfo, setGolfCourseInfo] = useState("");
  const [hwpFile, setHwpFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const [productSourceUrl, setProductSourceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<ImportResponse["parsed"] | null>(null);
  const progress = useSimulatedImportProgress();

  const assignHwpFile = useCallback((file: File | undefined | null) => {
    if (!file) return;
    if (!isHwpFilename(file.name)) {
      setError("hwp 또는 hwpx 파일만 업로드할 수 있습니다.");
      return;
    }
    setError(null);
    setHwpFile(file);
  }, []);

  const addImageFiles = useCallback((incoming: FileList | File[] | undefined | null) => {
    if (!incoming?.length) return;
    const next: File[] = [];
    for (const file of Array.from(incoming)) {
      if (!isImageOrZipFilename(file.name)) {
        setError("사진은 jpg, jpeg, png, webp 또는 zip만 올릴 수 있습니다.");
        return;
      }
      if (isZipFilename(file.name)) {
        if (file.size > MAX_BAND_IMPORT_ZIP_BYTES) {
          setError(
            `zip은 ${formatFileSize(MAX_BAND_IMPORT_ZIP_BYTES)} 이하만 올릴 수 있습니다. (${file.name}: ${formatFileSize(file.size)})`,
          );
          return;
        }
      } else if (file.size > MAX_BAND_IMPORT_IMAGE_BYTES) {
        setError(
          `사진 한 장은 ${formatFileSize(MAX_BAND_IMPORT_IMAGE_BYTES)} 이하만 올릴 수 있습니다. (${file.name}: ${formatFileSize(file.size)})`,
        );
        return;
      }
      next.push(file);
    }
    setError(null);
    setImageFiles((prev) => [...prev, ...next]);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingId(null);
    setSuccessSummary(null);
    setIsSubmitting(true);
    progress.start();

    try {
      const stagingImagePaths: Array<{ path: string; filename: string }> = [];
      for (const file of imageFiles) {
        stagingImagePaths.push(await uploadImageFileToStaging(file));
      }

      const formData = new FormData();
      formData.append("bandText", bandText);
      formData.append("golfCourseInfo", golfCourseInfo);
      if (hwpFile) formData.append("hwpFile", hwpFile);
      if (productSourceUrl.trim()) {
        formData.append("product_source_url", productSourceUrl.trim());
      }
      if (stagingImagePaths.length > 0) {
        formData.append("stagingImagePaths", JSON.stringify(stagingImagePaths));
      }

      const res = await fetch("/api/admin/products/import-band", {
        method: "POST",
        body: formData,
      });

      const raw = await res.text();
      let data: ImportResponse = {};
      try {
        data = raw ? (JSON.parse(raw) as ImportResponse) : {};
      } catch {
        progress.stop();
        if (res.status === 413) {
          setError("업로드 용량이 너무 큽니다. 한글 문서(HWP)를 20MB 이하로 줄여서 다시 시도해 주세요.");
          return;
        }
        setError(
          `서버 응답을 읽지 못했습니다 (${res.status || "네트워크"}). 잠시 후 다시 시도해 주세요.`,
        );
        return;
      }

      if (res.status === 409 && data.existingId) {
        progress.stop();
        setExistingId(data.existingId);
        setError(data.message ?? "이미 등록된 상품입니다.");
        return;
      }

      if (!res.ok) {
        progress.stop();
        setError(data.message ?? "상품 등록에 실패했습니다.");
        return;
      }

      if (data.id) {
        progress.complete();
        setSuccessSummary(data.parsed ?? null);
        const params = new URLSearchParams({
          [ADMIN_PRODUCTS_QUERY_KEYS.VIEW]: ADMIN_PRODUCTS_VIEW.CREATE,
          [ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID]: data.id,
        });
        router.push(`/theall_manager_only/products?${params.toString()}`);
      }
    } catch (error) {
      progress.stop();
      const detail = error instanceof Error ? error.message : "";
      if (/failed to fetch|networkerror|load failed/i.test(detail)) {
        setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setError(detail || "네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">상품 등록(밴드)</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          네이버 밴드 게시글과 한글 문서(.hwp / .hwpx)를 올리면 AI가 상품 필드를 추출해 등록합니다.
          사진이나 네이버 블로그 zip을 함께 올리면 대표·갤러리·일정 이미지로 배치합니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">밴드 본문</span>
          <textarea
            className={`${fieldClass} min-h-[160px]`}
            value={bandText}
            onChange={(e) => setBandText(e.target.value)}
            placeholder="네이버 밴드 게시글 전체를 붙여넣으세요."
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">골프장 정보 (선택)</span>
          <span className="block text-xs text-[var(--text-secondary)]">
            골프장 소개·코스 구성 등을 따로 붙여넣으세요. 비워 두면 상품 상세에 골프장 정보 섹션이
            나오지 않습니다.
          </span>
          <textarea
            className={`${fieldClass} min-h-[120px]`}
            value={golfCourseInfo}
            onChange={(e) => setGolfCourseInfo(e.target.value)}
            placeholder="예: 18홀 챔피언십 코스, 페어웨이·그린 특징, 클럽하우스 안내"
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">한글 문서</span>
          <span className="block text-xs text-[var(--text-secondary)]">
            한글 문서(.hwp / .hwpx)를 업로드하세요. 서버에서 본문·표를 추출한 뒤 AI가 상품 필드를
            채웁니다.
          </span>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              assignHwpFile(e.dataTransfer.files[0]);
            }}
            className={`rounded-lg border border-dashed px-4 py-5 transition ${
              isDragging
                ? "border-[var(--primary)] bg-[var(--surface-muted)]"
                : "border-[var(--border)] bg-[var(--surface)]"
            }`}
          >
            {hwpFile ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {hwpFile.name}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">{formatFileSize(hwpFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHwpFile(null)}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  제거
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
                <Upload className="h-6 w-6 text-[var(--text-secondary)]" aria-hidden />
                <span className="text-sm text-[var(--text-primary)]">
                  {isDragging ? "여기에 놓기" : "파일을 선택하거나 드래그 앤 드롭"}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">.hwp, .hwpx · 최대 20MB</span>
                <input
                  type="file"
                  accept={HWP_ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    assignHwpFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">밴드 URL (선택)</span>
          <input
            type="url"
            className={fieldClass}
            value={productSourceUrl}
            onChange={(e) => setProductSourceUrl(e.target.value)}
            placeholder="https://band.us/n/..."
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">상품 사진 (선택)</span>
          <span className="block text-xs text-[var(--text-secondary)]">
            jpg, png, jpeg, webp 여러 장 또는 네이버 블로그 zip. 일정표·로고·QR은 자동으로 제외합니다.
          </span>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingImages(true);
            }}
            onDragLeave={() => setIsDraggingImages(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingImages(false);
              addImageFiles(e.dataTransfer.files);
            }}
            className={`rounded-lg border border-dashed px-4 py-5 transition ${
              isDraggingImages
                ? "border-[var(--primary)] bg-[var(--surface-muted)]"
                : "border-[var(--border)] bg-[var(--surface)]"
            }`}
          >
            {imageFiles.length > 0 ? (
              <ul className="space-y-2">
                {imageFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{file.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setImageFiles((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                      제거
                    </button>
                  </li>
                ))}
                <li>
                  <label className="inline-flex cursor-pointer text-xs font-medium text-[var(--primary)]">
                    사진 더 추가
                    <input
                      type="file"
                      accept={IMAGE_ACCEPT}
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        addImageFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </li>
              </ul>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
                <Upload className="h-6 w-6 text-[var(--text-secondary)]" aria-hidden />
                <span className="text-sm text-[var(--text-primary)]">
                  {isDraggingImages ? "여기에 놓기" : "사진 또는 zip을 선택하거나 드래그 앤 드롭"}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  jpg, png, jpeg, webp, zip · 장당 10MB, zip 합계 100MB
                </span>
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    addImageFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
            {existingId && (
              <div className="mt-2">
                <Link
                  href={`/theall_manager_only/products?${ADMIN_PRODUCTS_QUERY_KEYS.VIEW}=${ADMIN_PRODUCTS_VIEW.CREATE}&${ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID}=${existingId}`}
                  className="font-medium underline"
                >
                  기존 상품 편집으로 이동
                </Link>
              </div>
            )}
          </div>
        )}

        {successSummary && (
          <div className="rounded-lg border border-[var(--success)]/40 bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success)]">
            등록 완료: {successSummary.title ?? "제목 미정"}
            {successSummary.price != null && ` · ${successSummary.price.toLocaleString("ko-KR")}원`}
            {successSummary.duration && ` · ${successSummary.duration}`}
          </div>
        )}

        <div className="flex gap-2">
          <AdminButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? "AI 파싱·등록 중..." : "상품 등록"}
          </AdminButton>
          <AdminButton
            type="button"
            variant="secondary"
            onClick={() => router.push("/theall_manager_only/products")}
          >
            상품 목록
          </AdminButton>
        </div>
      </form>

      <AdminImportProgressOverlay
        open={progress.open}
        percent={progress.percent}
        label={progress.label}
      />
    </div>
  );
}
