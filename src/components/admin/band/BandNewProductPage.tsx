"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/admin/ui/AdminButton";
import {
  ADMIN_PRODUCTS_QUERY_KEYS,
  ADMIN_PRODUCTS_VIEW,
} from "@/components/admin/products/adminProducts.constants";

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

function parseImageUrls(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function BandNewProductPage() {
  const router = useRouter();
  const [bandText, setBandText] = useState("");
  const [hwpText, setHwpText] = useState("");
  const [productSourceUrl, setProductSourceUrl] = useState("");
  const [imageUrlsText, setImageUrlsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<ImportResponse["parsed"] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingId(null);
    setSuccessSummary(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin/products/import-band", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bandText,
          hwpText,
          product_source_url: productSourceUrl.trim() || undefined,
          imageUrls: parseImageUrls(imageUrlsText),
        }),
      });

      const data = (await res.json()) as ImportResponse;

      if (res.status === 409 && data.existingId) {
        setExistingId(data.existingId);
        setError(data.message ?? "이미 등록된 상품입니다.");
        return;
      }

      if (!res.ok) {
        setError(data.message ?? "상품 등록에 실패했습니다.");
        return;
      }

      if (data.id) {
        setSuccessSummary(data.parsed ?? null);
        const params = new URLSearchParams({
          [ADMIN_PRODUCTS_QUERY_KEYS.VIEW]: ADMIN_PRODUCTS_VIEW.CREATE,
          [ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID]: data.id,
        });
        router.push(`/theall_manager_only/products?${params.toString()}`);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
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
          네이버 밴드 게시글과 HWP 문서 텍스트를 붙여넣으면 AI가 상품 필드를 추출해 등록합니다.
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
          <span className="text-sm font-medium text-[var(--text-primary)]">HWP 텍스트</span>
          <span className="block text-xs text-[var(--text-secondary)]">
            한글(HWP)에서 전체 선택 후 복사해 붙여넣으세요. 파일 업로드는 지원하지 않습니다.
          </span>
          <textarea
            className={`${fieldClass} min-h-[120px]`}
            value={hwpText}
            onChange={(e) => setHwpText(e.target.value)}
            placeholder="HWP 문서에서 복사한 텍스트"
          />
        </label>

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

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">이미지 URL (선택)</span>
          <span className="block text-xs text-[var(--text-secondary)]">
            한 줄에 하나씩 입력. 첫 URL이 대표 이미지로 사용됩니다.
          </span>
          <textarea
            className={`${fieldClass} min-h-[80px] font-mono text-xs`}
            value={imageUrlsText}
            onChange={(e) => setImageUrlsText(e.target.value)}
            placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.jpg"}
          />
        </label>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
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
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
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
    </div>
  );
}
